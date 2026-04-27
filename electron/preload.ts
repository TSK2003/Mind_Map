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
}

interface AgentTextResponse {
  provider: 'ollama' | 'local';
  model?: string;
  title: string;
  body: string;
}

const mindMapApi = {
  openVault: () => ipcRenderer.invoke('vault:open') as Promise<VaultFileResult | null>,
  saveVault: (filePath: string, vault: BrainVault) =>
    ipcRenderer.invoke('vault:save', filePath, vault) as Promise<VaultFileResult>,
  saveVaultAs: (vault: BrainVault) => ipcRenderer.invoke('vault:saveAs', vault) as Promise<VaultFileResult | null>,
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath') as Promise<string>,
  runAgent: (request: AgentRequest) => ipcRenderer.invoke('agent:run', request) as Promise<AgentTextResponse>,
};

contextBridge.exposeInMainWorld('secondBrain', mindMapApi);
contextBridge.exposeInMainWorld('mindMap', mindMapApi);

export type MindMapApi = typeof mindMapApi;
