import clsx from 'clsx';
import { KeyRound, Monitor, Moon, Server, Settings2, Sparkles, Sun, Cpu } from 'lucide-react';
import { useEffect } from 'react';
import { defaultOllamaBaseUrl, defaultOpenAIBaseUrl, defaultOpenAIModel } from '../../domain/chat';
import type { BrainVault, ChatProvider } from '../../domain/types';
import { useBrainStore } from '../../store/useBrainStore';

const themeOptions: Array<{ value: BrainVault['settings']['theme']; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const providerOptions: Array<{ value: ChatProvider; label: string; icon: typeof Sparkles }> = [
  { value: 'openai', label: 'OpenAI', icon: Sparkles },
  { value: 'local', label: 'Ollama', icon: Server },
  { value: 'openai-compatible', label: 'Custom API', icon: Cpu },
  { value: 'none', label: 'Offline', icon: KeyRound },
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

  function applyProvider(provider: ChatProvider) {
    updateChatSettings({ provider });
    updateSettings({ aiProvider: provider });
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">
            <Settings2 size={18} />
            <div>
              <h2>Workspace Settings</h2>
              <p>Configure appearance, diagram defaults, and chatbot access.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="settings-close" type="button" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="settings-close" 
              type="button" 
              onClick={onClose}
              style={{ background: 'var(--teal)', color: 'white', borderColor: 'var(--teal)' }}
            >
              Save Settings
            </button>
          </div>
        </div>

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

        <section className="settings-group">
          <div className="settings-group-heading">
            <span>AI provider</span>
            <strong>{chatSettings.provider === 'local' ? 'Ollama' : chatSettings.provider === 'openai' ? 'OpenAI' : chatSettings.provider === 'openai-compatible' ? 'Custom API' : 'Offline'}</strong>
          </div>
          <div className="segmented-control" role="group" aria-label="AI provider">
            {providerOptions.map((option) => {
              const Icon = option.icon;
              const isActive = option.value === chatSettings.provider;

              return (
                <button
                  key={option.value}
                  className={clsx('settings-option', isActive && 'is-active')}
                  type="button"
                  onClick={() => applyProvider(option.value)}
                >
                  <Icon size={16} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="settings-help">
            OpenAI lets the copilot turn prompts into workflow plans. Ollama keeps everything local. Offline mode uses the built-in planner only.
          </p>
        </section>

        <section className="settings-group">
          <div className="settings-group-heading">
            <span>Chatbot connection</span>
            <strong>{chatSettings.model || 'No model selected'}</strong>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Base URL</span>
              <input
                type="text"
                value={chatSettings.baseUrl}
                onChange={(event) => updateChatSettings({ baseUrl: event.target.value })}
                placeholder={chatSettings.provider === 'local' ? defaultOllamaBaseUrl : defaultOpenAIBaseUrl}
                disabled={chatSettings.provider === 'none'}
              />
            </label>
            <label className="settings-field">
              <span>Model</span>
              <input
                type="text"
                value={chatSettings.model}
                onChange={(event) => updateChatSettings({ model: event.target.value })}
                placeholder={chatSettings.provider === 'local' ? 'llama3.2' : defaultOpenAIModel}
                disabled={chatSettings.provider === 'none'}
              />
            </label>
            <label className="settings-field settings-field-wide">
              <span>API key</span>
              <input
                type="password"
                value={chatSettings.apiKey}
                onChange={(event) => updateChatSettings({ apiKey: event.target.value })}
                placeholder={chatSettings.provider === 'local' ? 'Not required for local Ollama' : 'Paste your OpenAI API key'}
                disabled={chatSettings.provider === 'none' || chatSettings.provider === 'local'}
              />
            </label>
          </div>
          <p className="settings-help">
            The key is saved locally in this app's settings so you do not need to re-enter it every time.
          </p>
        </section>
      </section>
    </div>
  );
}
