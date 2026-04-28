import {
  ArrowUp,
  Bot,
  Check,
  FileSearch,
  FileText,
  GitFork,
  Lightbulb,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getProviderLabel } from '../domain/chat';
import type { AgentResult, AgentTextResponse, WorkspaceView } from '../domain/types';
import { createAgentResult, describeActionPlan, planAgentActions } from '../services/assistant';
import { callOpenAI } from '../services/aiClient';
import { getDesktopApi } from '../services/desktop';
import { useBrainStore } from '../store/useBrainStore';
import { MapInspector } from './inspector/MapInspector';

const starterActions: Array<{ icon: typeof Lightbulb; label: string; prompt: string; view?: WorkspaceView }> = [
  { icon: Lightbulb, label: 'Mind map', prompt: 'Create a mind map workflow for the current topic', view: 'map' },
  { icon: GitFork, label: 'Flowchart', prompt: 'Create a flowchart for this workflow', view: 'flowchart' },
  { icon: FileSearch, label: 'Summarize', prompt: 'Summarize this workspace and suggest next steps' },
];

type SideTab = 'details' | 'copilot';

export function AssistantPanel() {
  const activeView = useBrainStore((state) => state.activeView);
  const setActiveView = useBrainStore((state) => state.setActiveView);
  const vault = useBrainStore((state) => state.vault);
  const chatSettings = useBrainStore((state) => state.chatSettings);
  const selectedPageId = useBrainStore((state) => state.selectedPageId);
  const selectedPage = useBrainStore((state) => state.vault.pages.find((page) => page.id === state.selectedPageId));
  const applyAgentResult = useBrainStore((state) => state.applyAgentResult);

  const [activeTab, setActiveTab] = useState<SideTab>('details');
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [reply, setReply] = useState<AgentResult | null>(null);

  const activeDiagram = useMemo(() => {
    if (activeView === 'map') {
      return vault.maps.find((map) => map.mode === 'mind-map');
    }

    if (activeView === 'flowchart') {
      return vault.maps.find((map) => map.mode === 'flowchart');
    }

    return undefined;
  }, [activeView, vault.maps]);

  const contextLabel = useMemo(() => {
    return activeDiagram?.title ?? vault.name;
  }, [activeDiagram?.title, vault.name]);

  const workspaceSummary = useMemo(
    () => [
      { label: 'Pages', value: vault.pages.length },
      { label: 'Nodes', value: activeDiagram?.nodes.length ?? 0 },
      { label: 'Edges', value: activeDiagram?.edges.length ?? 0 },
      { label: 'Tasks', value: vault.tasks.length },
    ],
    [activeDiagram?.edges.length, activeDiagram?.nodes.length, vault.pages.length, vault.tasks.length],
  );

  const canSend = prompt.trim().length > 0 && !isThinking;

  async function submitPrompt(value = prompt) {
    const trimmed = value.trim();
    if (!trimmed || isThinking) {
      return;
    }

    const actions = planAgentActions(trimmed, vault, selectedPageId, activeView);
    setIsThinking(true);
    setActiveTab('copilot');

    try {
      const needsRemoteConfig =
        (chatSettings.provider === 'openai' || chatSettings.provider === 'openai-compatible') &&
        (!chatSettings.baseUrl.trim() || !chatSettings.model.trim() || !chatSettings.apiKey.trim());

      if (needsRemoteConfig) {
        setReply(
          createAgentResult(trimmed, vault, actions, {
            provider: 'local',
            title: 'Finish chatbot setup',
            body: 'Add your OpenAI base URL, model, and API key in Settings so the chatbot can generate live workflow plans.',
          }),
        );
        setPrompt('');
        return;
      }

      const desktopApi = getDesktopApi();
      let textResponse: AgentTextResponse | undefined;

      if (desktopApi) {
        textResponse = await desktopApi.runAgent({
          prompt: trimmed,
          vault,
          selectedPageId,
          activeView,
          actionPlan: describeActionPlan(actions),
          chatSettings,
        });
      } else if (chatSettings.provider === 'openai' || chatSettings.provider === 'openai-compatible' || chatSettings.provider === 'local') {
        const aiResult = await callOpenAI(trimmed, chatSettings, activeView === 'flowchart' ? 'flowchart' : 'map');
        if (aiResult) {
          textResponse = {
            provider: chatSettings.provider,
            title: aiResult.title,
            body: aiResult.body,
            actions: aiResult.actions,
            model: aiResult.model,
          };
        }
      }

      setReply(createAgentResult(trimmed, vault, actions, textResponse));
    } catch {
      setReply(
        createAgentResult(trimmed, vault, actions, {
          provider: 'local',
          title: 'Offline action plan',
          body: 'The live model was unavailable, so I prepared a local workflow plan and ready-to-apply workspace actions instead.',
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
          <h2>Workflow Copilot</h2>
          <p>{contextLabel}</p>
        </div>
      </div>

      <div className="assistant-tabs" role="tablist" aria-label="Workflow panel tabs">
        <button
          className={activeTab === 'details' ? 'assistant-tab is-active' : 'assistant-tab'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
        >
          <FileText size={16} />
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
          {activeView === 'map' ? <MapInspector /> : null}

          <section className="side-panel-card">
            <div className="side-panel-header">
              <div>
                <h3>
                  {activeView === 'map'
                    ? 'Mind map workspace'
                    : 'Flowchart workspace'}
                </h3>
                <p>
                  Edit the active canvas and generate workflow structures from the copilot.
                </p>
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
              {activeView === 'map' ? (
                <>
                  <span><strong>Tab</strong> adds a child node.</span>
                  <span><strong>Shift + Tab</strong> adds a sibling node.</span>
                  <span><strong>Ctrl + Scroll</strong> zooms the canvas.</span>
                  <span><strong>Preview</strong> lets you drag the visible viewport.</span>
                </>
              ) : (
                <>
                  <span><strong>Double-click</strong> adds a new step.</span>
                  <span><strong>Connect</strong> links the selected block to another one.</span>
                  <span><strong>Ctrl + Scroll</strong> zooms the canvas.</span>
                  <span><strong>Preview</strong> lets you drag the visible viewport.</span>
                </>
              )}
            </div>
          </section>

          <section className="side-panel-card">
            <div className="side-panel-header">
              <div>
                <h3>AI connection</h3>
                <p>{getProviderLabel(chatSettings.provider)}{chatSettings.model ? ` - ${chatSettings.model}` : ''}</p>
              </div>
            </div>
            <div className="shortcut-list">
              <span>{chatSettings.apiKey.trim() ? 'API key saved in Settings.' : 'No API key stored yet.'}</span>
              <span>{chatSettings.baseUrl.trim() ? chatSettings.baseUrl : 'Open Settings to configure the chatbot endpoint.'}</span>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="assistant-action-grid">
            {starterActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  disabled={isThinking}
                  onClick={() => {
                    if (action.view) {
                      setActiveView(action.view);
                    }
                    void submitPrompt(action.prompt);
                  }}
                >
                  <Icon size={16} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>

          <div className="assistant-response">
            <div className="response-title">
              <Sparkles size={17} />
              <span>{isThinking ? 'Planning your workflow' : reply?.title ?? 'AI copilot'}</span>
            </div>
            <p>
              {isThinking
                ? 'Reviewing your workspace context and preparing the next diagram or note actions.'
                : reply?.body ?? 'Ask the copilot to generate a mind map, a flowchart, a stick diagram, or a note-driven workflow.'}
            </p>
            <div className="agent-meta">
              <span>
                {reply
                  ? reply.provider === 'openai' || reply.provider === 'openai-compatible'
                    ? reply.model || getProviderLabel(chatSettings.provider)
                    : reply.provider === 'ollama'
                      ? `Ollama${reply.model ? ` - ${reply.model}` : ''}`
                      : 'Offline planner'
                  : getProviderLabel(chatSettings.provider)}
              </span>
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
          placeholder="Describe the workflow you want as a mind map, flowchart, stick diagram, note, or summary."
          disabled={isThinking}
        />
        <button className="send-button" type="submit" title="Send" aria-label="Send" disabled={!canSend}>
          <ArrowUp size={17} />
        </button>
      </form>
    </aside>
  );
}
