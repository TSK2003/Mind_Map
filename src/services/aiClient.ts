import type { AgentAction, ChatSettings, DiagramMode, MindNodeData, DiagramNodeShape } from '../domain/types';

const SYSTEM_PROMPT = `You are an AI assistant inside a mind mapping and flowchart application.
When the user gives you a prompt, generate a structured diagram plan as valid JSON.
Do NOT wrap JSON in markdown code fences. Return raw JSON only.

Use this schema:
{
  "title": "Short diagram title",
  "body": "Brief 1-2 sentence summary for the user",
  "diagramType": "mind-map" or "flowchart",
  "nodes": [
    {
      "label": "Node label (keep short, 2-5 words)",
      "summary": "One sentence description",
      "tone": "teal" | "amber" | "rose" | "violet" | "lime" | "sky"
    }
  ],
  "edges": [
    { "sourceIndex": 0, "targetIndex": 1, "label": "optional edge label" }
  ]
}

Rules:
- Generate between 4 and 8 nodes.
- For mind-map: create a central topic with branches radiating outward. Do NOT include edges — the app will connect them radially.
- For flowchart: create sequential process steps with edges connecting them in order. Use shape hints: "start-end" for first/last, "diamond" for decisions, "rect" for process steps.
- Vary the tone colors across nodes for visual variety.
- Match the diagram type to the user's request. Default to mind-map unless they say flowchart/process/workflow/steps.`;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

interface AIParsedResult {
  title: string;
  body: string;
  diagramType: DiagramMode;
  nodes: Array<{
    label: string;
    summary?: string;
    tone?: MindNodeData['tone'];
    shape?: string;
  }>;
  edges?: Array<{
    sourceIndex: number;
    targetIndex: number;
    label?: string;
  }>;
}

function parseAIResponse(content: string): AIParsedResult | null {
  try {
    // Try to extract JSON from possible markdown wrapping
    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }
    const parsed = JSON.parse(jsonStr) as AIParsedResult;
    if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildActionsFromParsed(parsed: AIParsedResult): AgentAction[] {
  const actions: AgentAction[] = [];
  const diagramType = parsed.diagramType === 'flowchart' ? 'flowchart' : 'mind-map';

  const validTones = ['teal', 'amber', 'rose', 'violet', 'lime', 'sky'];
  const nodes = parsed.nodes.slice(0, 8).map((node, index) => ({
    label: typeof node.label === 'string' ? node.label.trim() : `Node ${index + 1}`,
    summary: typeof node.summary === 'string' ? node.summary.trim() : undefined,
    tone: (validTones.includes(String(node.tone)) ? node.tone : validTones[index % validTones.length]) as MindNodeData['tone'],
    shape: typeof node.shape === 'string' ? (node.shape as DiagramNodeShape) : undefined,
  }));

  const edges = Array.isArray(parsed.edges)
    ? parsed.edges.filter(
        (e) =>
          typeof e.sourceIndex === 'number' &&
          typeof e.targetIndex === 'number' &&
          e.sourceIndex >= 0 &&
          e.targetIndex >= 0 &&
          e.sourceIndex < nodes.length &&
          e.targetIndex < nodes.length,
      )
    : undefined;

  if (diagramType === 'mind-map') {
    actions.push({
      id: createId('ai-action'),
      type: 'create-map-nodes',
      label: `Generate mind map: ${parsed.title || 'AI Map'}`,
      payload: {
        title: parsed.title || 'AI Mind Map',
        diagramType: 'mind-map',
        nodes,
      },
    });
  } else {
    actions.push({
      id: createId('ai-action'),
      type: 'create-diagram',
      label: `Generate flowchart: ${parsed.title || 'AI Flowchart'}`,
      payload: {
        title: parsed.title || 'AI Flowchart',
        diagramType: 'flowchart',
        nodes,
        edges,
      },
    });
  }

  return actions;
}

export async function callOpenAI(
  prompt: string,
  chatSettings: ChatSettings,
  activeView: 'map' | 'flowchart' = 'map',
): Promise<{ title: string; body: string; actions: AgentAction[]; model?: string } | null> {
  const baseUrl = chatSettings.baseUrl.trim().replace(/\/+$/, '');
  const apiKey = chatSettings.apiKey.trim();
  const model = chatSettings.model.trim();

  if (!baseUrl || !model) {
    return null;
  }

  const diagramHint = activeView === 'flowchart'
    ? '\n\nThe user is on the FLOWCHART view. Generate a flowchart (set diagramType to "flowchart").'
    : '\n\nThe user is on the MIND MAP view. Generate a mind map (set diagramType to "mind-map").';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const isGPT55 = model.startsWith('gpt-5.5');
    const endpoint = isGPT55 ? `${baseUrl}/responses` : `${baseUrl}/chat/completions`;
    const bodyPayload = isGPT55
      ? { model, input: `${SYSTEM_PROMPT}${diagramHint}\n\nUser prompt: ${prompt}` }
      : {
          model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT + diagramHint },
            { role: 'user', content: prompt },
          ],
        };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      const msg = errorBody?.error?.message || `API returned status ${response.status}`;
      return {
        title: 'API Error',
        body: msg,
        actions: [],
        model,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      output_text?: string;
      model?: string;
    };

    const content = (isGPT55 ? data.output_text : data.choices?.[0]?.message?.content)?.trim();
    if (!content) {
      return {
        title: 'Empty response',
        body: 'The AI returned an empty response. Try rephrasing your prompt.',
        actions: [],
        model: data.model ?? model,
      };
    }

    const parsed = parseAIResponse(content);
    if (!parsed) {
      // AI returned text but not valid JSON — show as text response
      return {
        title: 'AI Response',
        body: content.slice(0, 500),
        actions: [],
        model: data.model ?? model,
      };
    }

    const actions = buildActionsFromParsed(parsed);

    return {
      title: parsed.title || 'AI Workflow',
      body: parsed.body || 'Generated a diagram from your prompt.',
      actions,
      model: data.model ?? model,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        title: 'Request timeout',
        body: 'The API request took too long. Check your connection and try again.',
        actions: [],
      };
    }
    return {
      title: 'Connection failed',
      body: 'Could not reach the API. Check the base URL and your internet connection.',
      actions: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}
