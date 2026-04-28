import type { AgentAction, AgentResult, AgentTextResponse, BrainVault, KnowledgePage, WorkspaceView } from '../domain/types';

const tones = ['teal', 'amber', 'sky', 'violet', 'rose', 'lime'] as const;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function pageText(page: KnowledgePage) {
  return page.blocks.map((block) => block.content).filter(Boolean).join(' ');
}

function titleFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/\b(generate|create|make|build|mind map|map|note|task|plan|for|about|from|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'New Idea';
  return cleaned.split(' ').slice(0, 7).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function splitIdeas(prompt: string, vault: BrainVault) {
  const selectedTerms = prompt
    .replace(/[^\w\s,.-]/g, ' ')
    .split(/[,.\n]| and | with | for | then | after | before /i)
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .slice(0, 6);

  if (selectedTerms.length >= 3) return selectedTerms;

  const vaultTopics = vault.pages.flatMap((page) => [page.title, ...page.tags]).filter(Boolean).slice(0, 4);
  return [...selectedTerms, ...vaultTopics, 'Review', 'Execution', 'Next Actions'].slice(0, 6);
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
    .sort((left, right) => right.score - left.score)
    .map((item) => item.page)
    .slice(0, 4);
}

function toTitleCase(value: string) {
  return value.split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getRequestedDiagramType(prompt: string, activeView?: WorkspaceView) {
  const normalizedPrompt = prompt.toLowerCase();
  if (/flow\s*chart|flowchart|workflow diagram|process diagram|workflow|steps|process/.test(normalizedPrompt) || activeView === 'flowchart') {
    return 'flowchart' as const;
  }
  return 'mind-map' as const;
}

function getFlowShape(label: string, index: number, lastIndex: number) {
  const normalized = label.toLowerCase();
  if (index === 0 || index === lastIndex) return 'start-end' as const;
  if (/(decide|approve|review|choice|if|branch|check)/.test(normalized)) return 'diamond' as const;
  if (/(input|capture|collect|receive)/.test(normalized)) return 'parallelogram' as const;
  if (/(database|store|save|record)/.test(normalized)) return 'cylinder' as const;
  if (/(document|report|export)/.test(normalized)) return 'document' as const;
  return 'rect' as const;
}

function buildWorkflowNodes(prompt: string, vault: BrainVault, diagramType: 'mind-map' | 'flowchart') {
  const title = titleFromPrompt(prompt);
  const terms = splitIdeas(prompt, vault);

  if (diagramType === 'mind-map') {
    return terms.map((idea, index) => ({
      label: toTitleCase(idea),
      summary: `AI branch for ${title}`,
      tone: tones[index % tones.length],
    }));
  }

  const steps = ['Start', ...terms.map((term) => toTitleCase(term)), 'Finish'];
  return steps.map((step, index) => ({
    label: step,
    summary: `Workflow step for ${title}`,
    tone: tones[index % tones.length],
    shape: getFlowShape(step, index, steps.length - 1),
  }));
}

export function planAgentActions(prompt: string, vault: BrainVault, _selectedPageId?: string, activeView?: WorkspaceView): AgentAction[] {
  const actions: AgentAction[] = [];
  const title = titleFromPrompt(prompt);
  const diagramType = getRequestedDiagramType(prompt, activeView);
  const workflowNodes = buildWorkflowNodes(prompt, vault, diagramType);

  if (diagramType === 'mind-map') {
    actions.push({
      id: createId('agent-action'),
      type: 'create-map-nodes',
      label: `Generate mind map: ${title}`,
      payload: { title, diagramType, nodes: workflowNodes },
    });
  } else {
    actions.push({
      id: createId('agent-action'),
      type: 'create-diagram',
      label: `Generate flowchart: ${title}`,
      payload: { title, diagramType, nodes: workflowNodes },
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
      ? `I found relevant workspace context in ${relevantPages.map((page) => page.title).join(', ')}.`
      : 'I did not find a strong existing match, so I treated this as a new workflow request.';
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
    title: textResponse?.title ?? 'Workflow copilot',
    body: textResponse?.body?.trim() || fallback,
    provider: textResponse?.provider ?? 'local',
    model: textResponse?.model,
    actions: textResponse?.actions?.length ? textResponse.actions : actions,
    createdAt: new Date().toISOString(),
    applied: false,
  } satisfies AgentResult;
}
