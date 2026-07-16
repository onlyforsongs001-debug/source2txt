import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import AdmZip from 'adm-zip';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

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

// Directories/files to always skip
const SKIP_PATTERNS = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'out/', 'coverage/',
  '__pycache__/', '.venv/', 'venv/', '.env/', '.tox/', '.eggs/', 'egg-info/',
  '.cache/', '.npm/', '.yarn/', '.pytest_cache/', '.mypy_cache/',
  '.idea/', '.vscode/', '.DS_Store', 'Thumbs.db',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.lock', 'Gemfile.lock',
  '*.min.js', '*.min.css', '*.bundle.js', '*.map',
];

const MAX_FILE_SIZE = 1024 * 1024; // 1MB max per text file

interface FileEntry {
  path: string;
  content: string;
  size: number;
}

function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.substring(i).toLowerCase() : '';
}

function shouldSkip(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.endsWith('/') && lower.includes(pattern)) return true;
    if (pattern.endsWith('/')) continue;
    if (lower === pattern) return true;
    if (pattern.startsWith('*') && lower.endsWith(pattern.slice(1))) return true;
  }
  return false;
}

function isTextFile(filename: string): boolean {
  return TEXT_EXTENSIONS.has(getExtension(filename));
}

// Remove comments and condense whitespace
function compressSourceCode(text: string, filePath: string): string {
  const ext = getExtension(filePath);
  let result = text;

  // Remove single-line comments
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

  // Collapse multiple blank lines to 1
  result = result.replace(/\n{3,}/g, '\n\n');
  // Trim leading/trailing whitespace per line
  result = result.split('\n').map(l => l.trim()).join('\n');
  // Remove leading/trailing empty lines
  result = result.replace(/^\n+/, '').replace(/\n+$/, '');

  return result;
}

function processTextFile(content: Buffer, filePath: string, compress: boolean, includePathHeader: boolean): string {
  try {
    let text = content.toString('utf-8');
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (compress) {
      text = compressSourceCode(text, filePath);
    }

    if (!text.trim()) return '';

    const header = includePathHeader
      ? `\n${'='.repeat(60)}\nFile: ${filePath}\n${'='.repeat(60)}\n`
      : '';
    return `${header}${text}\n`;
  } catch {
    return '';
  }
}

function chunkOutput(entries: string[], chunkSize: number): string[] {
  if (chunkSize <= 0 || entries.length <= chunkSize) return [entries.join('')];

  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize).join('');
    chunks.push(chunk);
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check daily limit for free tier
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, zip_daily_count, zip_daily_date')
      .eq('id', session.user.id)
      .single();

    const isPro = profile?.subscription_tier === 'pro';
    const today = new Date().toISOString().split('T')[0];

    if (!isPro) {
      const dailyDate = profile?.zip_daily_date || '';
      const dailyCount = dailyDate === today ? (profile?.zip_daily_count || 0) : 0;

      if (dailyCount >= 50) {
        return NextResponse.json(
          { error: 'Daily limit reached (50 extractions). Upgrade to Pro for unlimited.' },
          { status: 429 }
        );
      }
    }

    const formData = await request.formData();
    const zipFile = formData.get('zip') as File;
    const compress = formData.get('compress') === 'true';
    const chunkFiles = parseInt(formData.get('chunkFiles') as string) || 0; // 0 = no chunking

    if (!zipFile) {
      return NextResponse.json({ error: 'No ZIP file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await zipFile.arrayBuffer());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    const fileContents: string[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let imageCount = 0;
    let totalChars = 0;
    const skippedFiles: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const filePath = entry.entryName;

      // Path traversal protection
      if (filePath.includes('..') || filePath.startsWith('/') || filePath.startsWith('\\')) {
        skippedCount++;
        continue;
      }

      // Skip patterns
      if (shouldSkip(filePath)) {
        skippedCount++;
        continue;
      }

      const ext = getExtension(filePath);

      if (isTextFile(filePath)) {
        const content = entry.getData();
        if (content.length > MAX_FILE_SIZE) {
          skippedCount++;
          skippedFiles.push(`${filePath} (${(content.length / 1024).toFixed(0)}KB > 1MB)`);
          continue;
        }

        if (content.length === 0) {
          skippedCount++;
          continue;
        }

        const processed = processTextFile(content, filePath, compress, true);
        if (processed) {
          fileContents.push(processed);
          totalChars += processed.length;
          processedCount++;
        } else {
          skippedCount++;
        }
      } else if (IMAGE_EXTENSIONS.has(ext)) {
        imageCount++;
      } else {
        skippedCount++;
      }
    }

    const header = `# Source2Txt Extraction\nSource: ${zipFile.name}\nFiles: ${processedCount} extracted, ${imageCount} images, ${skippedCount} skipped\nChars: ${totalChars.toLocaleString()}\n---\n\n`;
    const footer = `\n---\nExtracted: ${new Date().toISOString()}`;

    let combinedText: string;
    let chunks: string[] = [];

    if (chunkFiles > 0) {
      chunks = chunkOutput(fileContents, chunkFiles);
      combinedText = header + chunks.join(`\n${'='.repeat(60)}\n[CHUNK BREAK]\n${'='.repeat(60)}\n`) + footer;
    } else {
      combinedText = header + fileContents.join('') + footer;
      chunks = fileContents.length > 0 ? [combinedText] : [header + '[No text files found in ZIP]' + footer];
    }

    // Increment daily counter (free tier) - atomic update
    if (!isPro) {
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('zip_daily_count, zip_daily_date')
        .eq('id', session.user.id)
        .single();

      if (currentProfile) {
        const currentDate = currentProfile.zip_daily_date || '';
        const nextCount = (currentDate === today ? (currentProfile.zip_daily_count || 0) : 0) + 1;
        await supabaseAdmin
          .from('profiles')
          .update({
            zip_daily_count: nextCount,
            zip_daily_date: today,
          })
          .eq('id', session.user.id)
          .eq('zip_daily_date', currentDate) // Optimistic lock
          .eq('zip_daily_count', currentProfile.zip_daily_count);
      }
    }

    const { data: job } = await supabaseAdmin
      .from('processing_jobs')
      .insert({
        user_id: session.user.id,
        file_name: zipFile.name,
        file_type: 'zip',
        credits_used: 0,
        status: 'completed',
        result_text: combinedText,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      text: combinedText,
      chunks,
      segments: [],
      stats: {
        processedCount,
        imageCount,
        skippedCount,
        totalFiles: entries.length,
        totalChars,
      },
      creditsRemaining: 0,
      isPro,
      zipDailyRemaining: isPro ? -1 : Math.max(0, 50 - (profile?.zip_daily_date === today ? (profile?.zip_daily_count || 0) : 0)),
    });
  } catch (error) {
    console.error('ZIP extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract ZIP file' },
      { status: 500 }
    );
  }
}
