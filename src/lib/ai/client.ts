import OpenAI from 'openai';

interface AIProvider {
  client: OpenAI;
  name: string;
  model: string;
}

function getDeepSeek(): AIProvider | null {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  return {
    client: new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    }),
    name: 'deepseek',
    model: 'deepseek-chat',
  };
}

function getMistral(): AIProvider | null {
  if (!process.env.MISTRAL_API_KEY) return null;
  return {
    client: new OpenAI({
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: 'https://api.mistral.ai/v1',
    }),
    name: 'mistral',
    model: 'mistral-small-latest',
  };
}

function isBalanceError(err: any): boolean {
  const msg = err?.message?.toLowerCase() || '';
  const status = err?.status;
  if (status === 401 || status === 403) return false;
  return (
    status === 402 ||
    msg.includes('insufficient') ||
    msg.includes('balance') ||
    msg.includes('quota') ||
    msg.includes('credit') ||
    msg.includes('payment')
  );
}

export interface ChatOptions {
  systemPrompt: string;
  userContent: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string;
  provider: string;
  model: string;
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  const providers: AIProvider[] = [];
  const ds = getDeepSeek();
  if (ds) providers.push(ds);
  const ms = getMistral();
  if (ms) providers.push(ms);

  if (providers.length === 0) {
    throw new Error('No AI provider configured. Set DEEPSEEK_API_KEY or MISTRAL_API_KEY in .env.local');
  }

  let lastError: Error | null = null;

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
    } catch (err: any) {
      lastError = err;
      console.error(`${provider.name} failed:`, err?.message);

      if (!isBalanceError(err)) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All AI providers failed');
}