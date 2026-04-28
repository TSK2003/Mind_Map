export type WorkspaceView = 'map' | 'flowchart';

export type DiagramMode = 'mind-map' | 'flowchart';

export type DiagramNodeShape =
  | 'rect'
  | 'diamond'
  | 'rounded'
  | 'start-end'
  | 'parallelogram'
  | 'hexagon'
  | 'cylinder'
  | 'document';

export type EdgeStyle = 'straight' | 'curved' | 'step';

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

export interface NodeAttachment {
  type: 'image' | 'pdf' | 'audio' | 'video' | 'document';
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface MindNodeData {
  [key: string]: unknown;
  label: string;
  noteId?: string;
  tone: 'teal' | 'amber' | 'rose' | 'violet' | 'lime' | 'sky';
  summary?: string;
  collapsed?: boolean;
  attachment?: NodeAttachment;
  shape?: DiagramNodeShape;
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
  mode: DiagramMode;
  layout: 'radial' | 'tree' | 'organic' | 'timeline' | 'swimlane' | 'sequence' | 'spine';
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

export type ChatProvider = 'local' | 'openai' | 'openai-compatible' | 'none';

export interface ChatSettings {
  provider: ChatProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type AgentActionType =
  | 'create-note'
  | 'create-map-nodes'
  | 'create-diagram'
  | 'create-task'
  | 'link-notes'
  | 'search'
  | 'summarize';

export interface AgentDiagramNode {
  label: string;
  summary?: string;
  tone?: MindNodeData['tone'];
  shape?: DiagramNodeShape;
}

export interface AgentDiagramEdge {
  sourceIndex: number;
  targetIndex: number;
  label?: string;
}

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
      shape?: DiagramNodeShape;
    }>;
    diagramType?: DiagramMode;
    edges?: AgentDiagramEdge[];
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
  provider: 'ollama' | 'openai' | 'openai-compatible' | 'local';
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
  activeView?: WorkspaceView;
  chatSettings?: ChatSettings;
}

export interface AgentTextResponse {
  provider: 'ollama' | 'openai' | 'openai-compatible' | 'local';
  model?: string;
  title: string;
  body: string;
  actions?: AgentAction[];
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
  settings: {
    theme: 'light' | 'dark' | 'system';
    aiProvider: ChatProvider;
    defaultMapLayout: MapDocument['layout'];
    edgeStyle: EdgeStyle;
  };
}

export interface VaultFileResult {
  path: string;
  vault: BrainVault;
}
