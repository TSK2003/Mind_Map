import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface BrainVault {
  name: string;
  updatedAt?: string;
  pages?: VaultPage[];
  maps?: VaultMap[];
  tasks?: VaultTask[];
  [key: string]: unknown;
}

interface VaultBlock {
  content?: string;
}

interface VaultPage {
  id?: string;
  title?: string;
  tags?: string[];
  blocks?: VaultBlock[];
}

interface VaultMapNode {
  data?: {
    label?: string;
  };
}

interface VaultMap {
  title?: string;
  nodes?: VaultMapNode[];
}

interface VaultTask {
  title?: string;
  status?: string;
  priority?: string;
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getWindowIconPath() {
  return isDev ? path.join(app.getAppPath(), 'src', 'ic_launcher.png') : path.join(process.resourcesPath, 'icon.png');
}

function compactVaultContext(vault: BrainVault) {
  const pages = vault.pages ?? [];
  const maps = vault.maps ?? [];
  const tasks = vault.tasks ?? [];

  return JSON.stringify(
    {
      name: vault.name,
      pages: pages.slice(0, 12).map((page) => ({
        id: page.id,
        title: page.title,
        tags: page.tags,
        text: Array.isArray(page.blocks)
          ? page.blocks
              .map((block) => block.content)
              .filter(Boolean)
              .join(' ')
              .slice(0, 900)
          : '',
      })),
      maps: maps.slice(0, 4).map((map) => ({
        title: map.title,
        nodes: Array.isArray(map.nodes) ? map.nodes.map((node) => node.data?.label).slice(0, 24) : [],
      })),
      tasks: tasks.slice(0, 12).map((task) => ({
        title: task.title,
        status: task.status,
        priority: task.priority,
      })),
    },
    null,
    2,
  );
}

async function runOllamaAgent(request: AgentRequest): Promise<AgentTextResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const tagsResponse = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: controller.signal,
    });

    if (!tagsResponse.ok) {
      return null;
    }

    const tags = (await tagsResponse.json()) as { models?: Array<{ name: string }> };
    const model = tags.models?.find((candidate) => !candidate.name.toLowerCase().includes('embed'))?.name ?? tags.models?.[0]?.name;

    if (!model) {
      return null;
    }

    const chatResponse = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: '10m',
        options: {
          temperature: 0.35,
        },
        messages: [
          {
            role: 'system',
            content:
              'You are the live AI agent inside Mind Map, an offline-first knowledge and mind mapping app. Answer using the supplied vault context. Be concise, practical, and convert the user request into useful next steps.',
          },
          {
            role: 'user',
            content: [
              `User prompt: ${request.prompt}`,
              `Planned app actions: ${request.actionPlan ?? 'none'}`,
              `Selected page id: ${request.selectedPageId ?? 'none'}`,
              'Vault context:',
              compactVaultContext(request.vault),
            ].join('\n\n'),
          },
        ],
      }),
    });

    if (!chatResponse.ok) {
      return null;
    }

    const payload = (await chatResponse.json()) as { message?: { content?: string }; model?: string };
    const body = payload.message?.content?.trim();

    if (!body) {
      return null;
    }

    return {
      provider: 'ollama',
      model: payload.model ?? model,
      title: 'Live AI response',
      body,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 740,
    title: 'Mind Map',
    icon: getWindowIconPath(),
    backgroundColor: '#f4f1ea',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function readVault(filePath: string): Promise<VaultFileResult> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return {
    path: filePath,
    vault: JSON.parse(raw) as BrainVault,
  };
}

async function writeVault(filePath: string, vault: BrainVault): Promise<VaultFileResult> {
  const payload = JSON.stringify(
    {
      ...vault,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  await fs.writeFile(filePath, payload, 'utf-8');
  return readVault(filePath);
}

ipcMain.handle('vault:open', async (): Promise<VaultFileResult | null> => {
  const openOptions = {
    title: 'Open Mind Map Vault',
    properties: ['openFile'],
    filters: [
      { name: 'Mind Map Vault', extensions: ['brain'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  } satisfies Electron.OpenDialogOptions;

  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, openOptions)
    : await dialog.showOpenDialog(openOptions);

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  return readVault(result.filePaths[0]);
});

ipcMain.handle('vault:save', async (_event, filePath: string, vault: BrainVault): Promise<VaultFileResult> => {
  return writeVault(filePath, vault);
});

ipcMain.handle('vault:saveAs', async (_event, vault: BrainVault): Promise<VaultFileResult | null> => {
  const saveOptions = {
    title: 'Save Mind Map Vault',
    defaultPath: `${vault.name.replace(/\s+/g, '-').toLowerCase()}.brain`,
    filters: [{ name: 'Mind Map Vault', extensions: ['brain'] }],
  } satisfies Electron.SaveDialogOptions;

  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions);

  if (result.canceled || !result.filePath) {
    return null;
  }

  return writeVault(result.filePath, vault);
});

ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));

ipcMain.handle('agent:run', async (_event, request: AgentRequest): Promise<AgentTextResponse> => {
  const ollama = await runOllamaAgent(request);

  if (ollama) {
    return ollama;
  }

  return {
    provider: 'local',
    title: 'Local agent response',
    body:
      'I could not reach a local Ollama model, so I used Mind Map’s built-in offline planner. I still applied the relevant app actions in your vault. To enable full live AI text generation, start Ollama and pull a model such as llama3.2 or gemma3.',
  };
});

app.whenReady().then(() => {
  app.setName('Mind Map');
  app.setAppUserModelId('com.aescion.mindmap');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
