import type { ChatProvider, ChatSettings } from './types';

export const defaultOllamaBaseUrl = 'http://127.0.0.1:11434';
export const defaultOpenAICompatibleBaseUrl = 'https://api.openai.com/v1';

export const defaultChatSettings: ChatSettings = {
  provider: 'none',
  baseUrl: '',
  apiKey: '',
  model: '',
};

export function getProviderLabel(provider: ChatProvider) {
  if (provider === 'local') {
    return 'Local AI';
  }

  if (provider === 'openai-compatible') {
    return 'API Chat';
  }

  return 'Offline';
}
