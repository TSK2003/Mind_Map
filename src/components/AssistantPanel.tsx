import { ArrowUp, Bot, FileSearch, Lightbulb, Map, MessageSquareText, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createAgentResult, describeActionPlan, planAgentActions } from '../services/assistant';
import { useBrainStore } from '../store/useBrainStore';
import type { AgentResult } from '../domain/types';

const starterActions = [
  { icon: Lightbulb, label: 'Expand idea', prompt: 'Expand this idea into a practical mind map' },
  { icon: Map, label: 'Generate map', prompt: 'Generate a mind map from the selected note' },
  { icon: FileSearch, label: 'Ask notes', prompt: 'Ask my notes for the most relevant insights' },
  { icon: MessageSquareText, label: 'Summarize', prompt: 'Summarize this vault and create next steps' },
];

export function AssistantPanel() {
  const vault = useBrainStore((state) => state.vault);
  const selectedPage = useBrainStore((state) => state.vault.pages.find((page) => page.id === state.selectedPageId));
  const selectedPageId = useBrainStore((state) => state.selectedPageId);
  const applyAgentResult = useBrainStore((state) => state.applyAgentResult);
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [reply, setReply] = useState<AgentResult>(() =>
    createAgentResult('summarize current vault', vault, planAgentActions('summarize current vault', vault)),
  );
  const contextLabel = useMemo(() => selectedPage?.title ?? vault.name, [selectedPage?.title, vault.name]);

  async function submitPrompt(value = prompt) {
    const trimmed = value.trim();
    if (!trimmed || isThinking) {
      return;
    }

    const actions = planAgentActions(trimmed, vault, selectedPageId);
    setIsThinking(true);

    try {
      const textResponse = window.secondBrain
        ? await window.secondBrain.runAgent({
            prompt: trimmed,
            vault,
            selectedPageId,
            actionPlan: describeActionPlan(actions),
          })
        : undefined;
      const result = createAgentResult(trimmed, vault, actions, textResponse);
      setReply(applyAgentResult(result));
    } catch {
      const result = createAgentResult(trimmed, vault, actions, {
        provider: 'local',
        title: 'Local agent response',
        body: 'The live model bridge failed, so I used the offline action planner and applied the result to the vault.',
      });
      setReply(applyAgentResult(result));
    } finally {
      setIsThinking(false);
    }

    setPrompt('');
  }

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <div className="assistant-avatar">
          <Bot size={20} />
        </div>
        <div>
          <h2>AI Copilot</h2>
          <p>{contextLabel}</p>
        </div>
      </div>
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
          <span>{isThinking ? 'Agent is working' : reply.title}</span>
        </div>
        <p>{isThinking ? 'Thinking with your vault context and preparing app actions...' : reply.body}</p>
        <div className="agent-meta">
          <span>{reply.provider === 'ollama' ? `Ollama${reply.model ? ` - ${reply.model}` : ''}` : 'Offline planner'}</span>
          <span>{reply.applied ? 'Applied' : 'Preview'}</span>
        </div>
        <div className="suggested-actions">
          {reply.actions.map((action) => (
            <button key={action.id} type="button" onClick={() => void submitPrompt(action.label)} disabled={isThinking}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <form
        className="prompt-box"
        onSubmit={(event) => {
          event.preventDefault();
          submitPrompt();
        }}
      >
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask, plan, map, or summarize" disabled={isThinking} />
        <button className="send-button" type="submit" title="Send" aria-label="Send" disabled={isThinking}>
          <ArrowUp size={17} />
        </button>
      </form>
    </aside>
  );
}
