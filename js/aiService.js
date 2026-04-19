/* ============================================
   TaskFlow AI — AI Service (OpenAI-compatible)
   ============================================ */

import { store } from './store.js';
import { getTasksForAIContext } from './taskManager.js';

/**
 * Schedule tasks with AI
 * Returns an array of scheduled items with priority, start/end times, and reasoning.
 */
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

  // Parse JSON response
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Find array in the response
    const arrStart = jsonStr.indexOf('[');
    const arrEnd = jsonStr.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1) {
      jsonStr = jsonStr.substring(arrStart, arrEnd + 1);
    }

    const schedule = JSON.parse(jsonStr);

    if (!Array.isArray(schedule)) {
      throw new Error('AI response is not an array');
    }

    // Validate: check if AI returned all tasks
    const returnedIds = new Set(schedule.map(s => s.id));
    const missingTasks = tasks.filter(t => !returnedIds.has(t.id));

    if (missingTasks.length > 0) {
      console.warn(`AI missed ${missingTasks.length} tasks:`, missingTasks.map(t => t.title));
      // Add missing tasks at the end with auto-generated schedule
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

/**
 * Chat with AI (streaming)
 * @param {string} message - User message
 * @param {function} onChunk - Called with each text chunk as it arrives
 * @returns {Promise<string>} Full response text
 */
export async function chatWithAI(message, onChunk) {
  const settings = store.getSettings();

  if (!settings.apiKey) {
    throw new Error('Please configure your API key in Settings ⚙️');
  }

  const tasks = getTasksForAIContext();
  const chatHistory = store.getChatHistory().slice(-20); // Last 20 messages

  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const systemPrompt = `You are TaskFlow AI, an intelligent productivity AGENT embedded in a task management app. You can both TALK to the user AND PERFORM ACTIONS on their tasks.

PERSONALITY:
- Warm, encouraging, understanding — you know the user struggles with procrastination
- Give practical, actionable advice (not generic motivational quotes)
- Be concise (2-4 short paragraphs max unless asked for more)
- Use emojis sparingly for warmth
- Reply in the same language the user uses

CONTEXT:
- Current date/time: ${currentDate}, ${currentTime}
- Working hours: ${settings.workStartHour}:00 to ${settings.workEndHour}:00
- Timezone: User's local timezone (all times should match this)

USER'S CURRENT TASK LIST:
${tasks.length > 0 ? JSON.stringify(tasks, null, 2) : '(No tasks yet)'}

AVAILABLE ACTIONS:
You can perform actions by appending a JSON block at the END of your message, after the marker "---ACTIONS---". Available actions:

1. CREATE a new task:
   {"action": "create_task", "title": "Task name", "description": "Optional desc", "deadline": "YYYY-MM-DDTHH:mm", "estimatedMinutes": 60, "category": "work|study|personal|health|other", "priority": "critical|high|medium|low", "subtasks": ["step 1", "step 2"]}

2. UPDATE an existing task (use id from task list):
   {"action": "update_task", "id": "task_id", "updates": {"title": "New title", "deadline": "...", "priority": "...", "description": "..."}}

3. DELETE a task:
   {"action": "delete_task", "id": "task_id"}

4. COMPLETE a task:
   {"action": "complete_task", "id": "task_id"}

RULES FOR ACTIONS:
- ALWAYS perform actions when the user asks you to create, modify, delete, or complete tasks. Do NOT just describe what to do — actually DO it.
- You can perform MULTIPLE actions at once by putting them in an array.
- When creating tasks, set reasonable defaults: estimate time, pick category, set priority based on context.
- When the user says "tạo task", "thêm task", "add task", "create task", etc. → USE create_task action.
- When breaking down a task, create SUBTASKS inside the main task.
- For deadlines, use format YYYY-MM-DDTHH:mm in the user's LOCAL timezone.
- Always respond with a friendly message BEFORE the actions block.
- If the user doesn't ask for an action, just chat normally without the ACTIONS block.

EXAMPLE:
User: "Tạo task học lái xe, deadline tháng sau"
Response:
Đã tạo task "Học lái xe" cho bạn! 🚗
---ACTIONS---
[{"action": "create_task", "title": "Học lái xe", "description": "Ôn tập lý thuyết và thực hành lái xe", "deadline": "2026-05-20T18:00", "estimatedMinutes": 120, "category": "personal", "priority": "medium"}]`;

  // Build messages array for the API
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add chat history
  chatHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  // Add current message
  messages.push({ role: 'user', content: message });

  // Call with streaming
  return callAIStreaming(messages, settings, onChunk);
}

/**
 * Non-streaming AI call
 */
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

  // Retry logic for rate limits
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

    // Retry on 429 rate limit
    if (res.status === 429 && attempt < maxRetries) {
      const waitSec = Math.pow(2, attempt + 1) + 1; // 3s, 5s, 9s
      console.warn(`Rate limited (429). Retrying in ${waitSec}s... (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(waitSec * 1000);
      continue;
    }

    const errorBody = await res.text();
    console.error('AI API error:', res.status, errorBody);
    throw new Error(`API error ${res.status}: ${getApiErrorMessage(res.status)}`);
  }
}

/**
 * Streaming AI call
 */
async function callAIStreaming(messages, settings, onChunk) {
  const body = {
    model: settings.model,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
    stream: true,
  };

  // Retry logic for rate limits
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

    // Retry on 429 rate limit
    if (res.status === 429 && attempt < maxRetries) {
      const waitSec = Math.pow(2, attempt + 1) + 1;
      console.warn(`Rate limited (429). Retrying in ${waitSec}s... (attempt ${attempt + 1}/${maxRetries})`);
      onChunk(`\n⏳ Rate limited — retrying in ${waitSec}s...\n`);
      await sleep(waitSec * 1000);
      continue;
    }

    const errorBody = await res.text();
    console.error('AI API error:', res.status, errorBody);
    throw new Error(`API error ${res.status}: ${getApiErrorMessage(res.status)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') break;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onChunk(content);
        }
      } catch (e) {
        // Skip unparseable lines
      }
    }
  }

  return fullText;
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
