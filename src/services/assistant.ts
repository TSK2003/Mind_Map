import type { AgentAction, AgentResult, AgentTextResponse, BrainVault, KnowledgePage } from '../domain/types';

const tones = ['teal', 'amber', 'sky', 'violet', 'rose', 'lime'] as const;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function pageText(page: KnowledgePage) {
  return page.blocks
    .map((block) => block.content)
    .filter(Boolean)
    .join(' ');
}

function titleFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/\b(generate|create|make|build|mind map|map|note|task|plan|for|about|from|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'New Idea';
  }

  return cleaned
    .split(' ')
    .slice(0, 7)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function splitIdeas(prompt: string, vault: BrainVault) {
  const selectedTerms = prompt
    .replace(/[^\w\s,.-]/g, ' ')
    .split(/[,.\n]| and | with | for /i)
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .slice(0, 5);

  if (selectedTerms.length >= 3) {
    return selectedTerms;
  }

  const vaultTopics = vault.pages
    .flatMap((page) => [page.title, ...page.tags])
    .filter(Boolean)
    .slice(0, 4);

  return [...selectedTerms, ...vaultTopics, 'Research', 'Execution', 'Next Actions'].slice(0, 6);
}

function findRelevantPages(prompt: string, vault: BrainVault) {
  const terms = prompt.toLowerCase().split(/\W+/).filter(Boolean);
  return vault.pages
    .map((page) => {
      const text = `${page.title} ${page.tags.join(' ')} ${pageText(page)}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
      return { page, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.page)
    .slice(0, 4);
}

export function planAgentActions(prompt: string, vault: BrainVault, selectedPageId?: string): AgentAction[] {
  const normalizedPrompt = prompt.toLowerCase();
  const actions: AgentAction[] = [];
  const title = titleFromPrompt(prompt);

  if (/(mind\s*map|map|brainstorm|visual|xmind|flowchart)/i.test(normalizedPrompt)) {
    actions.push({
      id: createId('agent-action'),
      type: 'create-map-nodes',
      label: `Generate mind map: ${title}`,
      payload: {
        title,
        nodes: splitIdeas(prompt, vault).map((idea, index) => ({
          label: idea.charAt(0).toUpperCase() + idea.slice(1),
          summary: `AI branch for ${title}`,
          tone: tones[index % tones.length],
        })),
      },
    });
  }

  if (/(note|document|write|outline|summary|summarize)/i.test(normalizedPrompt)) {
    actions.push({
      id: createId('agent-action'),
      type: 'create-note',
      label: `Create note: ${title}`,
      payload: {
        title,
        content: `AI generated working note for: ${prompt}`,
        tags: ['ai-generated', 'mind-map'],
      },
    });
  }

  if (/(task|todo|plan|project|roadmap|next step|schedule)/i.test(normalizedPrompt)) {
    actions.push({
      id: createId('agent-action'),
      type: 'create-task',
      label: `Create task: ${title}`,
      payload: {
        task: {
          title: `Work on ${title}`,
          priority: normalizedPrompt.includes('urgent') ? 'high' : 'medium',
        },
      },
    });
  }

  if (/(link|connect|backlink|relationship|relate)/i.test(normalizedPrompt)) {
    const relevant = findRelevantPages(prompt, vault);
    if (relevant.length >= 2) {
      actions.push({
        id: createId('agent-action'),
        type: 'link-notes',
        label: `Link ${relevant[0].title} to ${relevant[1].title}`,
        payload: {
          sourceId: selectedPageId ?? relevant[0].id,
          targetId: relevant[1].id,
        },
      });
    }
  }

  if (/(ask|find|search|where|what|which)/i.test(normalizedPrompt)) {
    actions.push({
      id: createId('agent-action'),
      type: 'search',
      label: `Search vault for "${prompt.slice(0, 48)}"`,
      payload: {
        query: prompt,
      },
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: createId('agent-action'),
      type: 'create-map-nodes',
      label: `Expand idea: ${title}`,
      payload: {
        title,
        nodes: splitIdeas(prompt, vault).map((idea, index) => ({
          label: idea.charAt(0).toUpperCase() + idea.slice(1),
          summary: 'Expanded by Mind Map agent',
          tone: tones[index % tones.length],
        })),
      },
    });
  }

  return actions;
}

export function describeActionPlan(actions: AgentAction[]) {
  return actions.map((action) => `${action.type}: ${action.label}`).join('\n');
}

export function buildOfflineAgentText(prompt: string, vault: BrainVault, actions: AgentAction[]) {
  const relevantPages = findRelevantPages(prompt, vault);
  const actionText = actions.map((action) => action.label).join(', ');
  const sourceText =
    relevantPages.length > 0
      ? `I found relevant vault context in ${relevantPages.map((page) => page.title).join(', ')}.`
      : 'I did not find a strong existing match, so I treated this as a new idea.';

  return `${sourceText} I prepared these app actions: ${actionText}.`;
}

export function createAgentResult(
  prompt: string,
  vault: BrainVault,
  actions: AgentAction[],
  textResponse?: AgentTextResponse,
) {
  const fallback = buildOfflineAgentText(prompt, vault, actions);

  return {
    id: createId('agent-result'),
    title: textResponse?.title ?? 'Mind Map agent',
    body: textResponse?.body?.trim() || fallback,
    provider: textResponse?.provider ?? 'local',
    model: textResponse?.model,
    actions,
    createdAt: new Date().toISOString(),
    applied: false,
  } satisfies AgentResult;
}

