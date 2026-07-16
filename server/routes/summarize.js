const express = require('express');
const OpenAI = require('openai');
const { getUserFromToken } = require('../lib/supabase');

const router = express.Router();

function getDeepSeek() {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  return {
    client: new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' }),
    name: 'deepseek', model: 'deepseek-chat',
  };
}

function getMistral() {
  if (!process.env.MISTRAL_API_KEY) return null;
  return {
    client: new OpenAI({ apiKey: process.env.MISTRAL_API_KEY, baseURL: 'https://api.mistral.ai/v1' }),
    name: 'mistral', model: 'mistral-small-latest',
  };
}

function isBalanceError(err) {
  const msg = err?.message?.toLowerCase() || '';
  const status = err?.status;
  if (status === 401 || status === 403) return false;
  return status === 402 || msg.includes('insufficient') || msg.includes('balance') ||
    msg.includes('quota') || msg.includes('credit') || msg.includes('payment');
}

async function chat(options) {
  const providers = [];
  const ds = getDeepSeek();
  if (ds) providers.push(ds);
  const ms = getMistral();
  if (ms) providers.push(ms);
  if (providers.length === 0) throw new Error('No AI provider configured');

  let lastError = null;
  for (const provider of providers) {
    try {
      const completion = await provider.client.chat.completions.create({
        model: provider.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userContent },
        ],
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.3,
      });
      const content = completion.choices[0]?.message?.content || '';
      return { content, provider: provider.name, model: provider.model };
    } catch (err) {
      lastError = err;
      if (!isBalanceError(err)) throw err;
    }
  }
  throw lastError || new Error('All AI providers failed');
}

router.post('/', async (req, res) => {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { text, length = 'medium' } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const lengthInstructions = {
      short: 'Provide a very brief summary in 2-3 sentences covering only the key points.',
      medium: 'Provide a concise summary covering the main topics and key details, around one paragraph.',
      detailed: 'Provide a comprehensive summary with key points, supporting details, and main conclusions in multiple paragraphs with bullet points.',
    };

    const result = await chat({
      systemPrompt: `You are a summarization assistant. ${lengthInstructions[length] || lengthInstructions.medium}
Format the output as clean Markdown. Keep the original language of the text.`,
      userContent: text,
      maxTokens: length === 'short' ? 512 : length === 'medium' ? 1024 : 2048,
    });

    res.json({ success: true, summary: result.content, length, provider: result.provider });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: 'Failed to summarize text' });
  }
});

module.exports = router;
