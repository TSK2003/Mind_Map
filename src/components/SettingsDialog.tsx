import clsx from 'clsx';
import { KeyRound, Link, Monitor, Moon, Settings2, Sparkles, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { defaultOllamaBaseUrl, defaultOpenAICompatibleBaseUrl } from '../domain/chat';
import type { BrainVault, ChatProvider } from '../domain/types';
import { useBrainStore } from '../store/useBrainStore';

const themeOptions: Array<{ value: BrainVault['settings']['theme']; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const providerOptions: Array<{ value: ChatProvider; label: string }> = [
  { value: 'local', label: 'Local Ollama' },
  { value: 'openai-compatible', label: 'API Chat' },
  { value: 'none', label: 'Offline only' },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const theme = useBrainStore((state) => state.vault.settings.theme);
  const chatSettings = useBrainStore((state) => state.chatSettings);
  const updateSettings = useBrainStore((state) => state.updateSettings);
  const updateChatSettings = useBrainStore((state) => state.updateChatSettings);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleProviderChange(provider: ChatProvider) {
    const nextBaseUrl =
      provider === 'local'
        ? chatSettings.baseUrl === defaultOpenAICompatibleBaseUrl || !chatSettings.baseUrl.trim()
          ? defaultOllamaBaseUrl
          : chatSettings.baseUrl
        : provider === 'openai-compatible'
          ? chatSettings.baseUrl === defaultOllamaBaseUrl || !chatSettings.baseUrl.trim()
            ? defaultOpenAICompatibleBaseUrl
            : chatSettings.baseUrl
          : chatSettings.baseUrl;

    updateSettings({ aiProvider: provider });
    updateChatSettings({
      provider,
      baseUrl: nextBaseUrl,
    });
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">
            <Settings2 size={18} />
            <div>
              <h2>Workspace Settings</h2>
              <p>Connect your chatbot and keep the workspace readable.</p>
            </div>
          </div>
          <button className="settings-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="settings-group">
          <div className="settings-group-heading">
            <span>Chatbot</span>
            <strong>{chatSettings.provider === 'none' ? 'offline planner' : 'live chat ready'}</strong>
          </div>
          <div className="segmented-control" role="group" aria-label="Chat provider">
            {providerOptions.map((option) => (
              <button
                key={option.value}
                className={clsx('settings-option', chatSettings.provider === option.value && 'is-active')}
                type="button"
                onClick={() => handleProviderChange(option.value)}
              >
                <Sparkles size={16} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-field-grid">
            <label className="settings-field">
              <span>
                <Link size={14} />
                Base URL
              </span>
              <input
                type="text"
                value={chatSettings.baseUrl}
                onChange={(event) => updateChatSettings({ baseUrl: event.target.value })}
                placeholder={chatSettings.provider === 'local' ? defaultOllamaBaseUrl : defaultOpenAICompatibleBaseUrl}
                disabled={chatSettings.provider === 'none'}
              />
            </label>

            <label className="settings-field">
              <span>
                <Sparkles size={14} />
                Model
              </span>
              <input
                type="text"
                value={chatSettings.model}
                onChange={(event) => updateChatSettings({ model: event.target.value })}
                placeholder={chatSettings.provider === 'local' ? 'llama3.2' : 'gpt-4o-mini'}
                disabled={chatSettings.provider === 'none'}
              />
            </label>
          </div>

          {chatSettings.provider === 'openai-compatible' ? (
            <label className="settings-field">
              <span>
                <KeyRound size={14} />
                API Key
              </span>
              <input
                type="password"
                value={chatSettings.apiKey}
                onChange={(event) => updateChatSettings({ apiKey: event.target.value })}
                placeholder="Paste your API key"
              />
            </label>
          ) : null}

          <p className="settings-help">
            {chatSettings.provider === 'local'
              ? 'Local Ollama uses /api/chat automatically. Leave model blank to use the first available installed model.'
              : chatSettings.provider === 'openai-compatible'
                ? 'Use a base URL that exposes /chat/completions. The key stays on this machine and is not written into the vault file.'
                : 'Offline mode keeps the planner active without calling any live model endpoint.'}
          </p>
        </section>

        <section className="settings-group">
          <div className="settings-group-heading">
            <span>Appearance</span>
            <strong>{theme}</strong>
          </div>
          <div className="segmented-control" role="group" aria-label="Theme">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  className={clsx('settings-option', theme === option.value && 'is-active')}
                  type="button"
                  onClick={() => updateSettings({ theme: option.value })}
                >
                  <Icon size={16} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}
