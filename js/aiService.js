/* ============================================
   TaskFlow AI — AI Service (OpenAI-compatible)
   ============================================ */

import { store } from './store.js';
import { getTasksForAIContext } from './taskManager.js';

/* ══════════════════════════════════════════════
   AGENT TOOLS (OpenAI function-calling schema)
   ══════════════════════════════════════════════ */

const CATEGORY_ENUM = ['work', 'study', 'personal', 'health', 'other'];
const PRIORITY_ENUM = ['critical', 'high', 'medium', 'low'];

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task for the user.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string' },
          deadline: { type: 'string', description: 'YYYY-MM-DDTHH:mm in user local timezone' },
          estimatedMinutes: { type: 'number', description: 'Estimated time in minutes' },
          category: { type: 'string', enum: CATEGORY_ENUM },
          priority: { type: 'string', enum: PRIORITY_ENUM },
          subtasks: { type: 'array', items: { type: 'string' }, description: 'Initial subtask titles' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update fields of an existing task. Passing subtasks REPLACES the current list — use add_subtasks to append instead.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task id from the task list' },
          title: { type: 'string' },
          description: { type: 'string' },
          deadline: { type: 'string' },
          estimatedMinutes: { type: 'number' },
          category: { type: 'string', enum: CATEGORY_ENUM },
          priority: { type: 'string', enum: PRIORITY_ENUM },
          subtasks: { type: 'array', items: { type: 'string' } },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_subtasks',
      description: 'Append subtasks to an existing task without touching its current subtasks.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          subtasks: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'subtasks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as completed.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_task',
      description: 'Fetch full details of a task (all fields including every subtask). Use when you need more than the summarized task list provides.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
];

/* ══════════════════════════════════════════════
   SYSTEM PROMPT FOR THE AGENT
   ══════════════════════════════════════════════ */

function buildAgentSystemPrompt() {
  const settings = store.getSettings();
  const tasks = getTasksForAIContext();

  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `You are TaskFlow AI, a productivity agent embedded in a task management app. You can BOTH chat with the user AND call tools to manage their tasks.

PERSONALITY:
- Warm, encouraging, understanding — the user struggles with procrastination
- Practical, actionable advice (not generic motivational quotes)
- Concise (2-4 short paragraphs max unless asked for more)
- Reply in the same language the user uses

CONTEXT:
- Current date/time: ${currentDate}, ${currentTime}
- Working hours: ${settings.workStartHour}:00 to ${settings.workEndHour}:00
- Timezone: user's local timezone (use it for deadlines)

USER'S CURRENT TASK LIST:
${tasks.length > 0 ? JSON.stringify(tasks, null, 2) : '(No tasks yet)'}

TOOLS:
You have tools (create_task, update_task, add_subtasks, delete_task, complete_task, get_task) to manage tasks. Call them when the user asks you to create/modify/remove/complete tasks — do NOT just describe what you would do. You can call multiple tools in parallel. After each tool call you'll see its result and can either call more tools or finish with a final message.

RULES:
- When the user says "tạo task", "thêm task", "add task", "create task" → call create_task.
- When breaking down an existing task, prefer add_subtasks over update_task so you don't overwrite existing subtasks.
- If the summarized task list doesn't show enough detail (e.g., full description), call get_task first.
- Deadlines must be YYYY-MM-DDTHH:mm in the user's local timezone.
- If the user is just chatting (no action needed), reply normally without calling any tool.
- Always include at least a short written reply to the user along with (or after) your tool calls, so the chat never feels silent.`;
}

/* ══════════════════════════════════════════════
   SCHEDULE TASKS WITH AI (non-streaming)
   ══════════════════════════════════════════════ */

export async function scheduleTasksWithAI() {
  const settings = store.getSettings();
  const tasks = getTasksForAIContext();

  if (tasks.length === 0) {
    throw new Error('No incomplete tasks to schedule.');
  }

  if (!settings.apiKey) {
    throw new Error('Please configure your API key in Settings ⚙️');
  }

  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const systemPrompt = `You are an expert personal productivity scheduler.
I will give you a list of tasks. Your job is to sort them into the most logical execution order — not by following fixed rules, but by reasoning like an experienced person who understands time management deeply.

Consider factors like:
- How urgent is this task really? (deadline proximity matters more than just the label)
- How long will it take? A long High-priority task due soon might need to start before a Critical task with plenty of time remaining.
- What happens if this task is delayed? (risk of missing deadline, blocking other tasks, cascading impact)
- Are there subtasks that need lead time?
- Is it smarter to batch similar categories together?
- Would doing a quick task now free up mental space for harder ones later?
- READ the description carefully. It may contain hidden urgency (e.g. "waiting for my response", "need to send before meeting"), dependencies ("can only start after X is done"), or context that overrides the priority label.
  Let the description influence your judgment — sometimes a "Low" priority task with a critical dependency in its description should jump to the top.

Use your judgment. Sometimes a "Low" priority task should be done first if it takes 5 minutes and clears the way. Sometimes a "Critical" task can wait if the deadline is 3 weeks away and a "High" task is due tomorrow.

SCHEDULING CONSTRAINTS:
- Working hours: ${settings.workStartHour}:00 to ${settings.workEndHour}:00.
- Add ${settings.breakMinutes}-minute breaks between tasks.
- Current date/time: ${currentDate}, ${currentTime}.
- If current time is past working hours, schedule starting from tomorrow.
- If tasks overflow today's working hours, continue to the next day.

For each task in the output, explain your reasoning in 1-2 sentences so the user can agree or override your decision.

Return ONLY a valid JSON array (no markdown, no code fences), with objects in this exact format:
[
  {
    "id": "task_id_here",
    "aiPriority": 1,
    "aiStartTime": "2026-04-19T09:00:00",
    "aiEndTime": "2026-04-19T10:30:00",
    "aiReason": "1-2 sentence reasoning for this position"
  }
]

CRITICAL: You MUST return ALL ${tasks.length} tasks. Do NOT skip any task. Every task ID from the input must appear in your output.

Order by aiPriority (1 = do first).`;

  const userPrompt = `Here are my current tasks:\n\n${JSON.stringify(tasks, null, 2)}\n\nPlease create an optimal schedule for me. Think carefully about each task — reason like a real productivity expert, not a sorting algorithm.`;

  const response = await callAI(systemPrompt, userPrompt, settings, false);

  try {
    let jsonStr = response.trim();

    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const arrStart = jsonStr.indexOf('[');
    const arrEnd = jsonStr.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1) {
      jsonStr = jsonStr.substring(arrStart, arrEnd + 1);
    }

    const schedule = JSON.parse(jsonStr);

    if (!Array.isArray(schedule)) {
      throw new Error('AI response is not an array');
    }

    const returnedIds = new Set(schedule.map(s => s.id));
    const missingTasks = tasks.filter(t => !returnedIds.has(t.id));

    if (missingTasks.length > 0) {
      console.warn(`AI missed ${missingTasks.length} tasks:`, missingTasks.map(t => t.title));
      let lastPriority = schedule.length;
      let lastEndTime = schedule.length > 0
        ? new Date(schedule[schedule.length - 1].aiEndTime)
        : new Date();

      for (const task of missingTasks) {
        lastPriority++;
        const startTime = new Date(lastEndTime.getTime() + 15 * 60000);
        const endTime = new Date(startTime.getTime() + (task.estimatedMinutes || 60) * 60000);
        schedule.push({
          id: task.id,
          aiPriority: lastPriority,
          aiStartTime: startTime.toISOString(),
          aiEndTime: endTime.toISOString(),
          aiReason: '(AI missed this task — auto-appended)',
        });
        lastEndTime = endTime;
      }
    }

    return schedule;
  } catch (e) {
    console.error('Failed to parse AI schedule response:', response);
    throw new Error('AI returned an invalid schedule. Please try again.');
  }
}

/* ══════════════════════════════════════════════
   AGENT TURN (streaming + tool calls)
   ══════════════════════════════════════════════ */

/**
 * Build the initial messages array for a new user turn.
 * Caller is responsible for running the agent loop afterwards.
 */
export function buildInitialAgentMessages(historyWithCurrent) {
  return [
    { role: 'system', content: buildAgentSystemPrompt() },
    ...historyWithCurrent.map(m => ({ role: m.role, content: m.content })),
  ];
}

/**
 * Run ONE agent turn (one API call).
 * Streams text deltas through onTextChunk.
 * Returns { text, toolCalls } where toolCalls is [{id, name, arguments}].
 */
export async function runAgentTurn(messages, onTextChunk) {
  const settings = store.getSettings();
  if (!settings.apiKey) {
    throw new Error('Please configure your API key in Settings ⚙️');
  }

  const body = {
    model: settings.model,
    messages,
    tools: AGENT_TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 2000,
    stream: true,
  };

  const maxRetries = 3;
  let res;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    res = await fetch(`${settings.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) break;

    if (res.status === 429 && attempt < maxRetries) {
      const waitSec = Math.pow(2, attempt + 1) + 1;
      console.warn(`Rate limited (429). Retrying in ${waitSec}s... (attempt ${attempt + 1}/${maxRetries})`);
      if (onTextChunk) onTextChunk(`\n⏳ Rate limited — retrying in ${waitSec}s...\n`);
      await sleep(waitSec * 1000);
      continue;
    }

    const errorBody = await res.text();
    console.error('AI API error:', res.status, errorBody);
    throw new Error(`API error ${res.status}: ${getApiErrorMessage(res.status)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const toolCallsByIndex = {}; // { [index]: {id, name, arguments} }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') break;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          text += delta.content;
          if (onTextChunk) onTextChunk(delta.content);
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const tcDelta of delta.tool_calls) {
            const idx = tcDelta.index ?? 0;
            if (!toolCallsByIndex[idx]) {
              toolCallsByIndex[idx] = { id: '', name: '', arguments: '' };
            }
            const acc = toolCallsByIndex[idx];
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function?.name) acc.name = tcDelta.function.name;
            if (tcDelta.function?.arguments) acc.arguments += tcDelta.function.arguments;
          }
        }
      } catch (e) {
        // Skip unparseable lines
      }
    }
  }

  const toolCalls = Object.keys(toolCallsByIndex)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => toolCallsByIndex[k])
    .filter(tc => tc.name);

  // Ensure every tool call has an id (some providers omit it — synthesize one)
  toolCalls.forEach((tc, i) => {
    if (!tc.id) tc.id = `call_${Date.now()}_${i}`;
  });

  return { text, toolCalls };
}

/* ══════════════════════════════════════════════
   Non-streaming helper (used by scheduler)
   ══════════════════════════════════════════════ */

async function callAI(systemPrompt, userMessage, settings, json = false) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const body = {
    model: settings.model,
    messages,
    temperature: 0.3,
    max_tokens: 8000,
  };

  if (json) {
    body.response_format = { type: 'json_object' };
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${settings.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }

    if (res.status === 429 && attempt < maxRetries) {
      const waitSec = Math.pow(2, attempt + 1) + 1;
      console.warn(`Rate limited (429). Retrying in ${waitSec}s... (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(waitSec * 1000);
      continue;
    }

    const errorBody = await res.text();
    console.error('AI API error:', res.status, errorBody);
    throw new Error(`API error ${res.status}: ${getApiErrorMessage(res.status)}`);
  }
}

function getApiErrorMessage(status) {
  const msgs = {
    401: 'Invalid API key. Check your key in Settings.',
    403: 'Access denied. Check your API permissions.',
    429: 'Rate limit exceeded. Retries exhausted — please wait 1 minute and try again.',
    500: 'Server error. Please try again.',
    503: 'Service unavailable. Please try again later.',
  };
  return msgs[status] || 'Unknown error occurred.';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
