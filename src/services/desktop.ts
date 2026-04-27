import type { AgentRequest, AgentTextResponse, BrainVault, VaultFileResult } from '../domain/types';

interface DesktopApi {
  openVault: () => Promise<VaultFileResult | null>;
  saveVault: (filePath: string, vault: BrainVault) => Promise<VaultFileResult>;
  saveVaultAs: (vault: BrainVault) => Promise<VaultFileResult | null>;
  getUserDataPath: () => Promise<string>;
  runAgent: (request: AgentRequest) => Promise<AgentTextResponse>;
}

export function getDesktopApi(): DesktopApi | undefined {
  return window.mindMap ?? window.secondBrain;
}

