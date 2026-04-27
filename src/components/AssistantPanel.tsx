import { ArrowUp, Bot, Brain, Check, FileSearch, Lightbulb, Map, MessageSquareText, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getProviderLabel } from '../domain/chat';
import type { AgentResult } from '../domain/types';
import { createAgentResult, describeActionPlan, planAgentActions } from '../services/assistant';
import { getDesktopApi } from '../services/desktop';
import { useBrainStore } from '../store/useBrainStore';
import { MapInspector } from './MapInspector';

const starterActions = [
  { icon: Lightbulb, label: 'Expand idea', prompt: 'Expand this idea into a practical mind map' },
  { icon: Map, label: 'Generate map', prompt: 'Generate a mind map from the selected note' },
  { icon: FileSearch, label: 'Ask notes', prompt: 'Ask my notes for the most relevant insights' },
  { icon: MessageSquareText, label: 'Summarize', prompt: 'Summarize this vault and create next steps' },
];

type SideTab = 'details' | 'copilot';

export function AssistantPanel() {
  const vault = useBrainStore((state) => state.vault);
  const chatSettings = useBrainStore((state) => state.chatSettings);
  const selectedPage = useBrainStore((state) => state.vault.pages.find((page) => page.id === state.selectedPageId));
  const selectedPageId = useBrainStore((state) => state.selectedPageId);
  const selectedMapNodeId = useBrainStore((state) => state.selectedMapNodeId);
  const applyAgentResult = useBrainStore((state) => state.applyAgentResult);
  const [activeTab, setActiveTab] = useState<SideTab>('details');
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [reply, setReply] = useState<AgentResult | null>(null);
  const contextLabel = useMemo(() => selectedPage?.title ?? vault.name, [selectedPage?.title, vault.name]);
  const canSend = prompt.trim().length > 0 && !isThinking;
  const workspaceSummary = useMemo(
    () => [
      { label: 'Pages', value: vault.pages.length },
      { label: 'Tasks', value: vault.tasks.length },
      { label: 'Links', value: vault.relationships.length },
      { label: 'Nodes', value: vault.maps[0]?.nodes.length ?? 0 },
    ],
    [vault.maps, vault.pages.length, vault.relationships.length, vault.tasks.length],
  );

  async function submitPrompt(value = prompt) {
    const trimmed = value.trim();
    if (!trimmed || isThinking) {
      return;
    }

    const actions = planAgentActions(trimmed, vault, selectedPageId);
    setIsThinking(true);
    setActiveTab('copilot');

    try {
      if (
        chatSettings.provider === 'openai-compatible' &&
        (!chatSettings.baseUrl.trim() || !chatSettings.model.trim() || !chatSettings.apiKey.trim())
      ) {
        setReply(
          createAgentResult(trimmed, vault, actions, {
            provider: 'local',
            title: 'Finish chatbot setup',
            body: 'The AI provider is not fully configured yet. I still prepared a local action plan for this request.',
          }),
        );
        setPrompt('');
        return;
      }

      const desktopApi = getDesktopApi();
      const textResponse = desktopApi
        ? await desktopApi.runAgent({
            prompt: trimmed,
            vault,
            selectedPageId,
            actionPlan: describeActionPlan(actions),
            chatSettings,
          })
        : undefined;

      setReply(createAgentResult(trimmed, vault, actions, textResponse));
    } catch {
      setReply(
        createAgentResult(trimmed, vault, actions, {
          provider: 'local',
          title: 'Offline action plan',
          body: 'The live model was unavailable, so I prepared the local workspace actions instead.',
        }),
      );
    } finally {
      setIsThinking(false);
    }

    setPrompt('');
  }

  function applyReplyActions() {
    if (!reply || reply.applied) {
      return;
    }

    setReply(applyAgentResult(reply));
    setActiveTab('details');
  }

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <div className="assistant-avatar">
          <Bot size={20} />
        </div>
        <div>
          <h2>Workspace Panel</h2>
          <p>{contextLabel}</p>
        </div>
      </div>

      <div className="assistant-tabs" role="tablist" aria-label="Workspace panel tabs">
        <button
          className={activeTab === 'details' ? 'assistant-tab is-active' : 'assistant-tab'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
        >
          <Brain size={16} />
          <span>Details</span>
        </button>
        <button
          className={activeTab === 'copilot' ? 'assistant-tab is-active' : 'assistant-tab'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'copilot'}
          onClick={() => setActiveTab('copilot')}
        >
          <Sparkles size={16} />
          <span>Copilot</span>
        </button>
      </div>

      {activeTab === 'details' ? (
        <>
          <MapInspector />
          <section className="side-panel-card">
            <div className="side-panel-header">
              <div>
                <h3>Workspace</h3>
                <p>{selectedMapNodeId ? 'Map editing is active' : 'Select a node to edit its content'}</p>
              </div>
            </div>
            <div className="workspace-metrics">
              {workspaceSummary.map((item) => (
                <div className="workspace-metric" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="shortcut-list">
              <span>`Ctrl/Cmd + K` command palette</span>
              <span>`Delete` remove selected node</span>
              <span>`Tab` add a child node</span>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="assistant-action-grid">
            {starterActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} type="button" onClick={() => void submitPrompt(action.prompt)} disabled={isThinking}>
                  <Icon size={16} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>

          <div className="assistant-response">
            <div className="response-title">
              <Sparkles size={17} />
              <span>{isThinking ? 'Planning your request' : reply?.title ?? 'AI copilot'}</span>
            </div>
            <p>
              {isThinking
                ? 'Reviewing your vault context and preparing the next workspace actions.'
                : reply?.body ?? 'Use the copilot to expand ideas, generate maps, summarize notes, or plan follow-up work.'}
            </p>
            <div className="agent-meta">
              <span>{reply ? (reply.provider === 'openai-compatible' ? reply.model || getProviderLabel(chatSettings.provider) : reply.provider === 'ollama' ? `Ollama${reply.model ? ` - ${reply.model}` : ''}` : 'Offline planner') : getProviderLabel(chatSettings.provider)}</span>
              <span>{reply?.applied ? 'Applied' : 'Preview'}</span>
            </div>
            {reply?.actions.length ? (
              <div className="assistant-plan-list">
                {reply.actions.map((action) => (
                  <span className="assistant-plan-chip" key={action.id}>
                    {action.label}
                  </span>
                ))}
              </div>
            ) : null}
            {reply && !reply.applied && reply.actions.length > 0 ? (
              <button className="assistant-apply" type="button" onClick={applyReplyActions}>
                <Check size={16} />
                <span>Apply planned changes</span>
              </button>
            ) : null}
          </div>
        </>
      )}

      <form
        className="prompt-box"
        onSubmit={(event) => {
          event.preventDefault();
          void submitPrompt();
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submitPrompt();
            }
          }}
          placeholder={activeTab === 'details' ? 'Ask the copilot to refine this workspace' : 'Ask, plan, map, or summarize'}
          disabled={isThinking}
        />
        <button className="send-button" type="submit" title="Send" aria-label="Send" disabled={!canSend}>
          <ArrowUp size={17} />
        </button>
      </form>
    </aside>
  );
}
