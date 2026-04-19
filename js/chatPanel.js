/* ============================================
   TaskFlow AI — Chat Panel (Agent Loop)
   ============================================ */

import { store } from './store.js';
import { runAgentTurn, buildInitialAgentMessages } from './aiService.js';
import { markdownToHtml, generateId } from './utils.js';
import { createTask, updateTask, deleteTask, toggleTask } from './taskManager.js';
import { renderAll } from './uiRenderer.js';

let isStreaming = false;

const MAX_AGENT_TURNS = 8;

/**
 * Initialize chat panel
 */
export function initChatPanel() {
  renderChatMessages();
  setupChatInput();
}

function setupChatInput() {
  const input = document.getElementById('chatInput');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

/**
 * Send a chat message — runs the full agent loop until the model stops calling tools.
 */
export async function sendMessage(text = null) {
  if (isStreaming) return;

  const input = document.getElementById('chatInput');
  const message = text || (input ? input.value.trim() : '');
  if (!message) return;

  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }

  // Persist user message + render
  store.addChatMessage({ role: 'user', content: message });
  appendMessage('user', message);

  showTypingIndicator();
  isStreaming = true;
  updateSendButton();

  try {
    // Build messages array for the API: system + last N of stored history (which now includes this user msg)
    const history = store.getChatHistory().slice(-20);
    const messages = buildInitialAgentMessages(history);

    // Agent loop: call model → execute tools → call again → repeat until no tool calls
    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      removeTypingIndicator();
      const assistantDiv = createAssistantBubble();
      let streamedText = '';

      const { text: turnText, toolCalls } = await runAgentTurn(messages, (chunk) => {
        streamedText += chunk;
        updateAssistantBubble(assistantDiv, streamedText);
      });

      // Finalize the bubble for this turn
      if (turnText && turnText.trim()) {
        updateAssistantBubble(assistantDiv, turnText);
        store.addChatMessage({ role: 'assistant', content: turnText });
      } else if (toolCalls.length === 0) {
        // No text and no tools — weird but show something
        updateAssistantBubble(assistantDiv, '(no response)');
      } else {
        // Empty text but tools pending — drop the empty bubble; action badges will follow
        assistantDiv.remove();
      }

      if (toolCalls.length === 0) break;

      // Record the assistant message with tool_calls so the model sees its own call on the next turn
      messages.push({
        role: 'assistant',
        content: turnText || '',
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments || '{}' },
        })),
      });

      // Execute each tool call and push a tool-result message per call
      showTypingIndicator();
      const displayResults = [];
      for (const tc of toolCalls) {
        let args = {};
        try {
          args = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch (e) {
          console.warn('Invalid tool arguments JSON:', tc.arguments, e);
        }
        const { display, toolResult } = executeTool(tc.name, args);
        displayResults.push(display);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        });
      }

      if (displayResults.length > 0) {
        appendActionResults(displayResults);
        renderAll();
      }
    }
  } catch (error) {
    removeTypingIndicator();
    appendMessage('assistant', `⚠️ ${error.message}`);
    store.addChatMessage({ role: 'assistant', content: `⚠️ ${error.message}` });
  } finally {
    removeTypingIndicator();
    isStreaming = false;
    updateSendButton();
  }
}

/* ══════════════════════════════════════════════
   TOOL EXECUTION
   ══════════════════════════════════════════════ */

/**
 * Execute a single tool call.
 * Returns { display, toolResult }:
 *   - display: object for the in-chat action badge
 *   - toolResult: object sent back to the model as the tool response
 */
function executeTool(name, args) {
  try {
    switch (name) {
      case 'create_task': {
        const task = createTask({
          title: args.title || 'Untitled Task',
          description: args.description || '',
          deadline: args.deadline || '',
          estimatedMinutes: args.estimatedMinutes || 60,
          category: args.category || 'other',
          priority: args.priority || 'medium',
          subtasks: Array.isArray(args.subtasks) ? args.subtasks : [],
        });
        return {
          display: { type: 'created', title: task.title },
          toolResult: { ok: true, id: task.id, title: task.title },
        };
      }

      case 'update_task': {
        if (!args.id) {
          return { display: { type: 'error', message: 'Missing task id' }, toolResult: { ok: false, error: 'Missing id' } };
        }
        const { id, ...updates } = args;
        if (Array.isArray(updates.subtasks)) {
          updates.subtasks = normalizeSubtasks(updates.subtasks);
        }
        const updated = updateTask(id, updates);
        if (!updated) {
          return { display: { type: 'error', message: `Task not found: ${id}` }, toolResult: { ok: false, error: 'Task not found' } };
        }
        return {
          display: { type: 'updated', title: updated.title },
          toolResult: { ok: true, id: updated.id, title: updated.title },
        };
      }

      case 'add_subtasks': {
        if (!args.id) {
          return { display: { type: 'error', message: 'Missing task id' }, toolResult: { ok: false, error: 'Missing id' } };
        }
        const task = store.getTask(args.id);
        if (!task) {
          return { display: { type: 'error', message: `Task not found: ${args.id}` }, toolResult: { ok: false, error: 'Task not found' } };
        }
        const incoming = Array.isArray(args.subtasks) ? args.subtasks : [];
        const newSubs = normalizeSubtasks(incoming);
        if (newSubs.length === 0) {
          return { display: { type: 'error', message: 'No valid subtasks provided' }, toolResult: { ok: false, error: 'No valid subtasks' } };
        }
        const merged = [...(task.subtasks || []), ...newSubs];
        updateTask(args.id, { subtasks: merged });
        return {
          display: { type: 'updated', title: `${task.title} (+${newSubs.length} subtasks)` },
          toolResult: { ok: true, id: task.id, added: newSubs.length, total: merged.length },
        };
      }

      case 'delete_task': {
        if (!args.id) {
          return { display: { type: 'error', message: 'Missing task id' }, toolResult: { ok: false, error: 'Missing id' } };
        }
        const task = store.getTask(args.id);
        if (!task) {
          return { display: { type: 'error', message: `Task not found: ${args.id}` }, toolResult: { ok: false, error: 'Task not found' } };
        }
        deleteTask(args.id);
        return {
          display: { type: 'deleted', title: task.title },
          toolResult: { ok: true, id: args.id },
        };
      }

      case 'complete_task': {
        if (!args.id) {
          return { display: { type: 'error', message: 'Missing task id' }, toolResult: { ok: false, error: 'Missing id' } };
        }
        const task = store.getTask(args.id);
        if (!task) {
          return { display: { type: 'error', message: `Task not found: ${args.id}` }, toolResult: { ok: false, error: 'Task not found' } };
        }
        if (!task.completed) toggleTask(args.id);
        return {
          display: { type: 'completed', title: task.title },
          toolResult: { ok: true, id: task.id, title: task.title },
        };
      }

      case 'get_task': {
        if (!args.id) {
          return { display: { type: 'error', message: 'Missing task id' }, toolResult: { ok: false, error: 'Missing id' } };
        }
        const task = store.getTask(args.id);
        if (!task) {
          return { display: { type: 'error', message: `Task not found: ${args.id}` }, toolResult: { ok: false, error: 'Task not found' } };
        }
        return {
          display: { type: 'fetched', title: task.title },
          toolResult: {
            ok: true,
            task: {
              id: task.id,
              title: task.title,
              description: task.description || '',
              deadline: task.deadline,
              estimatedMinutes: task.estimatedMinutes,
              category: task.category,
              priority: task.priority,
              completed: task.completed,
              subtasks: (task.subtasks || []).map(s => ({
                title: s && s.title ? s.title : String(s),
                completed: !!(s && s.completed),
              })),
            },
          },
        };
      }

      default:
        return {
          display: { type: 'error', message: `Unknown tool: ${name}` },
          toolResult: { ok: false, error: `Unknown tool: ${name}` },
        };
    }
  } catch (e) {
    console.error('Tool execution error:', name, e);
    return {
      display: { type: 'error', message: e.message },
      toolResult: { ok: false, error: e.message },
    };
  }
}

function normalizeSubtasks(list) {
  return list
    .map(s => {
      if (typeof s === 'string') {
        return { id: generateId(), title: s.trim(), completed: false };
      }
      if (s && typeof s === 'object') {
        return {
          id: s.id || generateId(),
          title: (s.title || '').trim(),
          completed: !!s.completed,
        };
      }
      return null;
    })
    .filter(s => s && s.title);
}

/* ══════════════════════════════════════════════
   CHAT RENDERING
   ══════════════════════════════════════════════ */

export function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const history = store.getChatHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">🤖</div>
        <div class="chat-welcome-title">Hi! I'm TaskFlow AI</div>
        <div class="chat-welcome-text">
          I can help you manage your tasks, break down complex work, and overcome procrastination. Ask me anything!
        </div>
      </div>
      <div class="quick-actions" id="quickActions">
        <button class="quick-action-chip" onclick="window.app.quickChat('What should I work on next?')">🎯 What's next?</button>
        <button class="quick-action-chip" onclick="window.app.quickChat('Analyze my current workload')">📊 Workload analysis</button>
        <button class="quick-action-chip" onclick="window.app.quickChat('I feel overwhelmed and don\\'t know where to start')">😰 Feeling stuck</button>
        <button class="quick-action-chip" onclick="window.app.quickChat('Give me a motivational tip to stop procrastinating')">💪 Motivate me</button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  history.forEach(msg => {
    appendMessage(msg.role, msg.content, false);
  });

  scrollToBottom();
}

function appendMessage(role, content, scroll = true) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.remove();
  const quick = container.querySelector('.quick-actions');
  if (quick) quick.remove();

  const div = document.createElement('div');
  div.className = `chat-message ${role}`;

  const avatar = role === 'assistant' ? '🤖' : '👤';
  const bubbleContent = role === 'assistant' ? markdownToHtml(content) : escHtml(content);

  div.innerHTML = `
    <div class="chat-avatar">${avatar}</div>
    <div class="chat-bubble">${bubbleContent}</div>
  `;

  container.appendChild(div);
  if (scroll) scrollToBottom();
}

function createAssistantBubble() {
  const container = document.getElementById('chatMessages');
  if (!container) return null;

  removeTypingIndicator();

  // Drop any leftover welcome/quick-action blocks so the bubble isn't orphaned above them
  const welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.remove();
  const quick = container.querySelector('.quick-actions');
  if (quick) quick.remove();

  const div = document.createElement('div');
  div.className = 'chat-message assistant';
  div.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="chat-bubble"></div>
  `;

  container.appendChild(div);
  scrollToBottom();
  return div;
}

function updateAssistantBubble(div, text) {
  if (!div) return;
  const bubble = div.querySelector('.chat-bubble');
  if (bubble) {
    bubble.innerHTML = markdownToHtml(text);
    scrollToBottom();
  }
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  removeTypingIndicator();

  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;

  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function updateSendButton() {
  const btn = document.getElementById('chatSendBtn');
  if (btn) {
    btn.disabled = isStreaming;
    btn.innerHTML = isStreaming ? '<div class="spinner" style="width:16px;height:16px;"></div>' : '➤';
  }
}

export function clearChat() {
  store.clearChatHistory();
  renderChatMessages();
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Show action badges in chat for executed tool calls.
 */
function appendActionResults(results) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'chat-actions-result';

  const icons = {
    created: '✅ Created',
    updated: '✏️ Updated',
    deleted: '🗑️ Deleted',
    completed: '☑️ Completed',
    fetched: '🔍 Fetched',
    error: '⚠️ Error',
  };

  const badges = results.map(r => {
    const label = icons[r.type] || r.type;
    const detail = r.title || r.message || '';
    const cls = r.type === 'error' ? 'action-badge error' : 'action-badge success';
    return `<span class="${cls}">${label}: ${escHtml(detail)}</span>`;
  }).join('');

  div.innerHTML = `<div class="action-badges">${badges}</div>`;
  container.appendChild(div);
  scrollToBottom();
}
