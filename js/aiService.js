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

  const systemPrompt = `You are an expert AI productivity scheduler for people who struggle with procrastination and time management.

Your job is to analyze the user's task list and create an optimal execution schedule.

STRICT PRIORITY RULES (follow this order — DO NOT rearrange):
1. OVERDUE tasks (past deadline) → schedule FIRST, immediately.
2. Then sort by PRIORITY LEVEL strictly: critical > high > medium > low.
   - NEVER put a "low" or "medium" task before a "high" or "critical" task.
   - When two tasks have the SAME priority, the one with the EARLIER deadline goes first.
   - When two tasks have the SAME priority AND SAME deadline, the one with shorter estimated time goes first.
3. Working hours: ${settings.workStartHour}:00 to ${settings.workEndHour}:00.
4. Add ${settings.breakMinutes}-minute breaks between tasks.
5. Current date/time: ${currentDate}, ${currentTime}.
6. If current time is past working hours, schedule from tomorrow's start.
7. If tasks overflow today's working hours, continue to the next day.
8. Give a short, encouraging reason for each task's position (this helps the user feel motivated).

IMPORTANT: The priority field is the MOST important factor. A "critical" task must ALWAYS come before "high", "high" before "medium", "medium" before "low". No exceptions.

Return ONLY a valid JSON array (no markdown, no code fences), with objects in this exact format:
[
  {
    "id": "task_id_here",
    "aiPriority": 1,
    "aiStartTime": "2026-04-19T09:00:00",
    "aiEndTime": "2026-04-19T10:30:00",
    "aiReason": "Short explanation of why this task is scheduled here"
  }
]

Order by aiPriority (1 = do first).`;

  const userPrompt = `Here are my current tasks:\n\n${JSON.stringify(tasks, null, 2)}\n\nPlease create an optimal schedule for me. Remember: I tend to procrastinate, so make the plan achievable and motivating.`;

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

  const systemPrompt = `You are TaskFlow AI, a friendly and empathetic productivity assistant embedded in a task management app.

PERSONALITY:
- Warm, encouraging, understanding — you know the user struggles with procrastination
- Give practical, actionable advice (not generic motivational quotes)
- Be concise (2-4 short paragraphs max unless asked for more)
- Use emojis sparingly for warmth
- Reply in the same language the user uses

CONTEXT:
- Current date/time: ${currentDate}, ${currentTime}
- Working hours: ${settings.workStartHour}:00 to ${settings.workEndHour}:00

USER'S CURRENT TASK LIST:
${tasks.length > 0 ? JSON.stringify(tasks, null, 2) : '(No tasks yet)'}

CAPABILITIES:
- Help break down tasks into smaller steps
- Suggest which task to do next
- Provide time management tips
- Motivate and help overcome procrastination
- Analyze workload and suggest adjustments
- Help set realistic deadlines`;

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
    max_tokens: 4000,
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
