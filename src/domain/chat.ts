import type { ChatProvider, ChatSettings } from './types';

export const defaultOllamaBaseUrl = 'http://127.0.0.1:11434';
export const defaultOpenAIBaseUrl = 'https://api.openai.com/v1';
export const defaultOpenAIModel = 'gpt-4.1-mini';

export const defaultChatSettings: ChatSettings = {
  provider: 'none',
  baseUrl: '',
  apiKey: '',
  model: '',
};

export function getProviderLabel(provider: ChatProvider) {
  if (provider === 'local') {
    return 'Ollama';
  }

  if (provider === 'openai' || provider === 'openai-compatible') {
    return 'OpenAI';
  }

  return 'Offline';
}
