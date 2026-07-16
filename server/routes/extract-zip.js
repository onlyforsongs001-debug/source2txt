const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.env',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.pl', '.sh', '.bash', '.zsh',
  '.css', '.scss', '.sass', '.less', '.html', '.htm', '.svg',
  '.sql', '.graphql', '.proto', '.toml', '.ini', '.cfg', '.conf',
  '.log', '.vue', '.svelte', '.astro', '.mjs', '.cjs', '.mts', '.cts',
  '.bat', '.ps', '.ps1', '.psm1', '.psd1',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.ico']);

const SKIP_PATTERNS = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'out/', 'coverage/',
  '__pycache__/', '.venv/', 'venv/', '.env/', '.tox/', '.eggs/', 'egg-info/',
  '.cache/', '.npm/', '.yarn/', '.pytest_cache/', '.mypy_cache/',
  '.idea/', '.vscode/', '.DS_Store', 'Thumbs.db',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.lock', 'Gemfile.lock',
  '*.min.js', '*.min.css', '*.bundle.js', '*.map',
];

const MAX_FILE_SIZE = 1024 * 1024;

function getExtension(filename) {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.substring(i).toLowerCase() : '';
}

function shouldSkip(filePath) {
  const lower = filePath.toLowerCase();
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.endsWith('/') && lower.includes(pattern)) return true;
    if (pattern.endsWith('/')) continue;
    if (lower === pattern) return true;
    if (pattern.startsWith('*') && lower.endsWith(pattern.slice(1))) return true;
  }
  return false;
}

function isTextFile(filename) { return TEXT_EXTENSIONS.has(getExtension(filename)); }

function compressSourceCode(text, filePath) {
  const ext = getExtension(filePath);
  let result = text;

  if (['.js', '.ts', '.jsx', '.tsx', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.php', '.vue', '.svelte'].includes(ext)) {
    result = result.replace(/\/\/.*$/gm, '');
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  }
  if (['.py', '.rb', '.pl', '.sh', '.bash', '.zsh', '.yaml', '.yml'].includes(ext)) {
    result = result.replace(/#.*$/gm, '');
  }
  if (['.html', '.htm', '.xml', '.svg'].includes(ext)) {
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  }
  if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.split('\n').map(l => l.trim()).join('\n');
  result = result.replace(/^\n+/, '').replace(/\n+$/, '');
  return result;
}

function processTextFile(content, filePath, compress, includePathHeader) {
  try {
    let text = content.toString('utf-8');
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (compress) text = compressSourceCode(text, filePath);
    if (!text.trim()) return '';
    const header = includePathHeader ? `\n${'='.repeat(60)}\nFile: ${filePath}\n${'='.repeat(60)}\n` : '';
    return `${header}${text}\n`;
  } catch { return ''; }
}

function chunkOutput(entries, chunkSize) {
  if (chunkSize <= 0 || entries.length <= chunkSize) return [entries.join('')];
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize).join(''));
  }
  return chunks;
}

router.post('/', upload.single('zip'), async (req, res) => {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { user } = auth;
    const zipFile = req.file;
    const compress = req.body.compress === 'true';
    const chunkFiles = parseInt(req.body.chunkFiles) || 0;

    if (!zipFile) return res.status(400).json({ error: 'No ZIP file provided' });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, zip_daily_count, zip_daily_date')
      .eq('id', user.id)
      .single();

    const isPro = profile?.subscription_tier === 'pro';
    const today = new Date().toISOString().split('T')[0];

    if (!isPro) {
      const dailyDate = profile?.zip_daily_date || '';
      const dailyCount = dailyDate === today ? (profile?.zip_daily_count || 0) : 0;
      if (dailyCount >= 50) {
        return res.status(429).json({ error: 'Daily limit reached (50 extractions). Upgrade to Pro for unlimited.' });
      }
    }

    const zip = new AdmZip(zipFile.buffer);
    const entries = zip.getEntries();

    const fileContents = [];
    let processedCount = 0, skippedCount = 0, imageCount = 0, totalChars = 0;
    const skippedFiles = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const filePath = entry.entryName;
      if (filePath.includes('..') || filePath.startsWith('/') || filePath.startsWith('\\')) { skippedCount++; continue; }
      if (shouldSkip(filePath)) { skippedCount++; continue; }

      const ext = getExtension(filePath);
      if (isTextFile(filePath)) {
        const content = entry.getData();
        if (content.length > MAX_FILE_SIZE) { skippedCount++; skippedFiles.push(`${filePath} (${(content.length / 1024).toFixed(0)}KB > 1MB)`); continue; }
        if (content.length === 0) { skippedCount++; continue; }
        const processed = processTextFile(content, filePath, compress, true);
        if (processed) { fileContents.push(processed); totalChars += processed.length; processedCount++; }
        else { skippedCount++; }
      } else if (IMAGE_EXTENSIONS.has(ext)) { imageCount++; }
      else { skippedCount++; }
    }

    const header = `# Source2Txt Extraction\nSource: ${zipFile.originalname}\nFiles: ${processedCount} extracted, ${imageCount} images, ${skippedCount} skipped\nChars: ${totalChars.toLocaleString()}\n---\n\n`;
    const footer = `\n---\nExtracted: ${new Date().toISOString()}`;

    let combinedText, chunks = [];
    if (chunkFiles > 0) {
      chunks = chunkOutput(fileContents, chunkFiles);
      combinedText = header + chunks.join(`\n${'='.repeat(60)}\n[CHUNK BREAK]\n${'='.repeat(60)}\n`) + footer;
    } else {
      combinedText = header + fileContents.join('') + footer;
      chunks = fileContents.length > 0 ? [combinedText] : [header + '[No text files found in ZIP]' + footer];
    }

    if (!isPro) {
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles').select('zip_daily_count, zip_daily_date').eq('id', user.id).single();
      if (currentProfile) {
        const currentDate = currentProfile.zip_daily_date || '';
        const nextCount = (currentDate === today ? (currentProfile.zip_daily_count || 0) : 0) + 1;
        await supabaseAdmin.from('profiles').update({ zip_daily_count: nextCount, zip_daily_date: today })
          .eq('id', user.id).eq('zip_daily_date', currentDate).eq('zip_daily_count', currentProfile.zip_daily_count);
      }
    }

    await supabaseAdmin.from('processing_jobs').insert({
      user_id: user.id, file_name: zipFile.originalname, file_type: 'zip',
      credits_used: 0, status: 'completed', result_text: combinedText, completed_at: new Date().toISOString(),
    }).select().single();

    res.json({
      success: true, text: combinedText, chunks, segments: [],
      stats: { processedCount, imageCount, skippedCount, totalFiles: entries.length, totalChars },
      creditsRemaining: 0, isPro,
      zipDailyRemaining: isPro ? -1 : Math.max(0, 50 - (profile?.zip_daily_date === today ? (profile?.zip_daily_count || 0) : 0)),
    });
  } catch (error) {
    console.error('ZIP extraction error:', error);
    res.status(500).json({ error: 'Failed to extract ZIP file' });
  }
});

module.exports = router;
