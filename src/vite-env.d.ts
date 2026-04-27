/// <reference types="vite/client" />

import type { AgentRequest, AgentTextResponse, BrainVault, VaultFileResult } from './domain/types';

interface MindMapApi {
  openVault: () => Promise<VaultFileResult | null>;
  saveVault: (filePath: string, vault: BrainVault) => Promise<VaultFileResult>;
  saveVaultAs: (vault: BrainVault) => Promise<VaultFileResult | null>;
  getUserDataPath: () => Promise<string>;
  runAgent: (request: AgentRequest) => Promise<AgentTextResponse>;
  onMenuAction: (channel: string, callback: () => void) => () => void;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    secondBrain?: MindMapApi;
    mindMap?: MindMapApi;
  }
}
