import { app, BrowserWindow, dialog, ipcMain, shell, type BrowserWindow as BrowserWindowType, type IpcMainInvokeEvent, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

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
  chatSettings?: {
    provider: 'local' | 'openai-compatible' | 'none';
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };
}

interface AgentTextResponse {
  provider: 'ollama' | 'openai-compatible' | 'local';
  model?: string;
  title: string;
  body: string;
}

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const defaultSystemPrompt =
  'You are the live AI agent inside Mind Map, an offline-first knowledge and mind mapping app. Answer using the supplied vault context. Be concise, practical, and convert the user request into useful next steps.';
const defaultOllamaBaseUrl = 'http://127.0.0.1:11434';
const backupRetentionLimit = 24;
const backupThrottleMs = 1000 * 60 * 5;

let mainWindow: BrowserWindowType | null = null;

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getWindowIconPath() {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return isDev ? path.join(app.getAppPath(), 'src', 'ic_launcher.png') : path.join(resourcesPath ?? app.getAppPath(), 'icon.png');
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function sanitizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'vault';
}

function buildPromptContent(request: AgentRequest) {
  return [
    `User prompt: ${request.prompt}`,
    `Planned app actions: ${request.actionPlan ?? 'none'}`,
    `Selected page id: ${request.selectedPageId ?? 'none'}`,
    'Vault context:',
    compactVaultContext(request.vault),
  ].join('\n\n');
}

function extractOpenAIContent(payload: unknown) {
  const choice = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (typeof part === 'object' && part && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
}

function extractApiErrorMessage(payload: unknown, status: number, baseUrl: string) {
  const errorPayload = payload as {
    error?: {
      message?: unknown;
    };
    message?: unknown;
  };

  const directMessage =
    typeof errorPayload?.error?.message === 'string'
      ? errorPayload.error.message
      : typeof errorPayload?.message === 'string'
        ? errorPayload.message
        : '';

  if (directMessage) {
    return directMessage.trim();
  }

  if (status === 401) {
    return 'The API key was rejected. Check that the key is correct and still active.';
  }

  if (status === 403) {
    return 'The API request was forbidden. Check the project permissions for this key.';
  }

  if (status === 429) {
    return baseUrl.includes('api.openai.com')
      ? 'OpenAI rejected the request because billing, credits, quota, or rate limits are not available for this project.'
      : 'The API request was rate limited or the provider account does not currently allow the request.';
  }

  return `The API request failed with status ${status}.`;
}

async function runOllamaAgent(request: AgentRequest): Promise<AgentTextResponse | null> {
  const baseUrl = trimTrailingSlash(request.chatSettings?.baseUrl?.trim() || defaultOllamaBaseUrl);
  const configuredModel = request.chatSettings?.model?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    let model = configuredModel;

    if (!model) {
      const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      if (!tagsResponse.ok) {
        return null;
      }

      const tags = (await tagsResponse.json()) as { models?: Array<{ name: string }> };
      model = tags.models?.find((candidate) => !candidate.name.toLowerCase().includes('embed'))?.name ?? tags.models?.[0]?.name;
    }

    if (!model) {
      return null;
    }

    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
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
            content: defaultSystemPrompt,
          },
          {
            role: 'user',
            content: buildPromptContent(request),
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

async function runOpenAICompatibleAgent(request: AgentRequest): Promise<AgentTextResponse | null> {
  const baseUrl = trimTrailingSlash(request.chatSettings?.baseUrl?.trim() || '');
  const apiKey = request.chatSettings?.apiKey?.trim();
  const model = request.chatSettings?.model?.trim();

  if (!baseUrl || !apiKey || !model) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: 'system',
            content: defaultSystemPrompt,
          },
          {
            role: 'user',
            content: buildPromptContent(request),
          },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        provider: 'openai-compatible',
        model,
        title: 'API chat error',
        body: `${extractApiErrorMessage(payload, response.status, baseUrl)} I still used the offline planner and applied the requested workspace actions.`,
      };
    }

    const body = extractOpenAIContent(payload);

    if (!body) {
      return {
        provider: 'openai-compatible',
        model,
        title: 'API chat error',
        body: 'The API answered without usable message content. I still used the offline planner and applied the requested workspace actions.',
      };
    }

    return {
      provider: 'openai-compatible',
      model,
      title: 'API chat response',
      body,
    };
  } catch {
    return {
      provider: 'openai-compatible',
      model,
      title: 'API chat connection failed',
      body: 'I could not reach the configured API endpoint. Check your internet connection, firewall, base URL, and provider availability. I still used the offline planner and applied the requested workspace actions.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function createFallbackAgentResponse(request: AgentRequest): AgentTextResponse {
  const provider = request.chatSettings?.provider ?? 'local';

  if (provider === 'openai-compatible') {
    const hasConfig = Boolean(request.chatSettings?.baseUrl?.trim() && request.chatSettings?.apiKey?.trim() && request.chatSettings?.model?.trim());

    return {
      provider: 'local',
      title: hasConfig ? 'API chat unavailable' : 'Finish chatbot setup',
      body: hasConfig
        ? 'I could not reach your configured API endpoint, so I used Mind Map\'s offline planner instead. Check the base URL, key, and model in Settings.'
        : 'Add the API base URL, model name, and API key in Settings to use your chatbot provider.',
    };
  }

  if (provider === 'none') {
    return {
      provider: 'local',
      title: 'Offline planner response',
      body: 'Live chat is turned off in Settings, so I used Mind Map\'s offline planner and still prepared the relevant vault actions.',
    };
  }

  return {
    provider: 'local',
    title: 'Local agent response',
    body:
      'I could not reach your local Ollama model, so I used Mind Map\'s built-in offline planner. To enable full live AI text generation, start Ollama and optionally set the model in Settings.',
  };
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

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
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

async function writeVaultBackup(filePath: string, payload: string) {
  const vaultName = sanitizeName(path.basename(filePath, path.extname(filePath)));
  const backupRoot = path.join(app.getPath('userData'), 'vault-backups', vaultName);
  const extension = path.extname(filePath) || '.brain';

  await fs.mkdir(backupRoot, { recursive: true });

  const existingEntries = await fs.readdir(backupRoot, { withFileTypes: true });
  const existingBackups = await Promise.all(
    existingEntries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(backupRoot, entry.name);
        const stats = await fs.stat(fullPath);
        return {
          fullPath,
          stats,
        };
      }),
  );

  const newestBackup = existingBackups
    .slice()
    .sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs)[0];

  if (newestBackup && Date.now() - newestBackup.stats.mtimeMs < backupThrottleMs) {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupRoot, `${timestamp}${extension}`);
  await fs.writeFile(backupPath, payload, 'utf-8');

  const backupsAfterWrite = [...existingBackups, { fullPath: backupPath, stats: await fs.stat(backupPath) }]
    .sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs)
    .slice(backupRetentionLimit);

  await Promise.all(backupsAfterWrite.map((backup) => fs.rm(backup.fullPath, { force: true })));
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
  try {
    await writeVaultBackup(filePath, payload);
  } catch {
    // Ignore backup issues so the primary vault save still succeeds.
  }
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
  } satisfies OpenDialogOptions;

  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, openOptions)
    : await dialog.showOpenDialog(openOptions);

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  return readVault(result.filePaths[0]);
});

ipcMain.handle('vault:save', async (_event: IpcMainInvokeEvent, filePath: string, vault: BrainVault): Promise<VaultFileResult> => {
  return writeVault(filePath, vault);
});

ipcMain.handle('vault:saveAs', async (_event: IpcMainInvokeEvent, vault: BrainVault): Promise<VaultFileResult | null> => {
  const saveOptions = {
    title: 'Save Mind Map Vault',
    defaultPath: `${vault.name.replace(/\s+/g, '-').toLowerCase()}.brain`,
    filters: [{ name: 'Mind Map Vault', extensions: ['brain'] }],
  } satisfies SaveDialogOptions;

  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions);

  if (result.canceled || !result.filePath) {
    return null;
  }

  return writeVault(result.filePath, vault);
});

ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));

ipcMain.handle('agent:run', async (_event: IpcMainInvokeEvent, request: AgentRequest): Promise<AgentTextResponse> => {
  if (request.chatSettings?.provider === 'openai-compatible') {
    const remoteResponse = await runOpenAICompatibleAgent(request);
    return remoteResponse ?? createFallbackAgentResponse(request);
  }

  if (request.chatSettings?.provider === 'none') {
    return createFallbackAgentResponse(request);
  }

  const ollama = await runOllamaAgent(request);

  if (ollama) {
    return ollama;
  }

  return {
    provider: 'local',
    title: 'Local agent response',
    body:
      'I could not reach a local Ollama model, so I used Mind Map\'s built-in offline planner. I still applied the relevant app actions in your vault. To enable full live AI text generation, start Ollama and pull a model such as llama3.2 or gemma3.',
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
