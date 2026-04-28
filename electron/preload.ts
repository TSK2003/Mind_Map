import { contextBridge, ipcRenderer } from 'electron';

interface BrainVault {
  name: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface VaultFileResult {
  path: string;
  vault: BrainVault;
}

interface AgentRequest {
  prompt: string;
  vault: BrainVault;
  selectedPageId?: string;
  actionPlan?: string;
  activeView?: 'map' | 'notes' | 'graph' | 'tasks' | 'dashboard' | 'flowchart' | 'stickDiagram';
  chatSettings?: {
    provider: 'local' | 'openai' | 'openai-compatible' | 'none';
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };
}

interface AgentTextResponse {
  provider: 'ollama' | 'openai' | 'openai-compatible' | 'local';
  model?: string;
  title: string;
  body: string;
  actions?: Array<{
    id: string;
    type: 'create-note' | 'create-map-nodes' | 'create-diagram' | 'create-task';
  }>;
}

const mindMapApi = {
  openVault: () => ipcRenderer.invoke('vault:open') as Promise<VaultFileResult | null>,
  saveVault: (filePath: string, vault: BrainVault) =>
    ipcRenderer.invoke('vault:save', filePath, vault) as Promise<VaultFileResult>,
  saveVaultAs: (vault: BrainVault) => ipcRenderer.invoke('vault:saveAs', vault) as Promise<VaultFileResult | null>,
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath') as Promise<string>,
  runAgent: (request: AgentRequest) => ipcRenderer.invoke('agent:run', request) as Promise<AgentTextResponse>,
  onMenuAction: (channel: string, callback: () => void) => {
    ipcRenderer.on(channel, callback);
    return () => { ipcRenderer.removeListener(channel, callback); };
  },
};

contextBridge.exposeInMainWorld('secondBrain', mindMapApi);
contextBridge.exposeInMainWorld('mindMap', mindMapApi);

export type MindMapApi = typeof mindMapApi;
