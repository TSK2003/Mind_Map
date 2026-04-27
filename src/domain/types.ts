export type WorkspaceView = 'map' | 'notes' | 'graph' | 'tasks' | 'dashboard';

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'table'
  | 'image'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'embed';

export interface PageBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface KnowledgePage {
  id: string;
  title: string;
  icon: string;
  parentId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blocks: PageBlock[];
  links: string[];
  metadata: Record<string, string | number | boolean>;
}

export interface MindNodeData {
  [key: string]: unknown;
  label: string;
  noteId?: string;
  tone: 'teal' | 'amber' | 'rose' | 'violet' | 'lime' | 'sky';
  summary?: string;
  collapsed?: boolean;
}

export interface MindMapNode {
  id: string;
  type?: string;
  selected?: boolean;
  position: {
    x: number;
    y: number;
  };
  data: MindNodeData;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
}

export interface MapDocument {
  id: string;
  title: string;
  mode: 'mind-map' | 'concept-map' | 'whiteboard' | 'flowchart' | 'knowledge-graph';
  layout: 'radial' | 'tree' | 'organic' | 'timeline' | 'swimlane';
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  updatedAt: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'backlink' | 'reference' | 'derived-from' | 'supports' | 'contradicts' | 'task-for';
  strength: number;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  kind: 'image' | 'pdf' | 'audio' | 'video' | 'document' | 'web-clip';
  mimeType: string;
  localPath: string;
  linkedEntityIds: string[];
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  status: 'backlog' | 'active' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  linkedPageIds: string[];
}

export type ChatProvider = 'local' | 'openai-compatible' | 'none';

export interface ChatSettings {
  provider: ChatProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type AgentActionType = 'create-note' | 'create-map-nodes' | 'create-task' | 'link-notes' | 'search' | 'summarize';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  label: string;
  payload?: {
    title?: string;
    content?: string;
    tags?: string[];
    nodes?: Array<{
      label: string;
      summary?: string;
      tone?: MindNodeData['tone'];
    }>;
    task?: {
      title: string;
      priority?: TaskItem['priority'];
      dueDate?: string;
    };
    sourceId?: string;
    targetId?: string;
    query?: string;
  };
}

export interface AgentResult {
  id: string;
  title: string;
  body: string;
  provider: 'ollama' | 'openai-compatible' | 'local';
  model?: string;
  actions: AgentAction[];
  createdAt: string;
  applied: boolean;
}

export interface AgentRequest {
  prompt: string;
  vault: BrainVault;
  selectedPageId?: string;
  actionPlan?: string;
  chatSettings?: ChatSettings;
}

export interface AgentTextResponse {
  provider: 'ollama' | 'openai-compatible' | 'local';
  model?: string;
  title: string;
  body: string;
}

export interface Goal {
  id: string;
  title: string;
  progress: number;
  linkedTaskIds: string[];
}

export interface Habit {
  id: string;
  title: string;
  streak: number;
  cadence: 'daily' | 'weekly';
}

export interface BrainVault {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  pages: KnowledgePage[];
  maps: MapDocument[];
  relationships: Relationship[];
  attachments: Attachment[];
  tasks: TaskItem[];
  goals: Goal[];
  habits: Habit[];
  settings: {
    theme: 'light' | 'dark' | 'system';
    aiProvider: ChatProvider;
    defaultMapLayout: MapDocument['layout'];
  };
}

export interface VaultFileResult {
  path: string;
  vault: BrainVault;
}
