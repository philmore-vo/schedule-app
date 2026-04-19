/* ============================================
   TaskFlow AI — Chat Panel
   ============================================ */

import { store } from './store.js';
import { chatWithAI } from './aiService.js';
import { markdownToHtml, generateId } from './utils.js';
import { createTask, updateTask, deleteTask, toggleTask } from './taskManager.js';
import { showToast, renderAll } from './uiRenderer.js';

let isStreaming = false;

/**
 * Initialize chat panel
 */
export function initChatPanel() {
  renderChatMessages();
  setupChatInput();
}

/**
 * Setup chat input event listeners
 */
function setupChatInput() {
  const input = document.getElementById('chatInput');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

/**
 * Send a chat message
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

  // Add user message
  store.addChatMessage({ role: 'user', content: message });
  appendMessage('user', message);

  // Show typing indicator
  showTypingIndicator();
  isStreaming = true;
  updateSendButton();

  try {
    // Create assistant message container
    const assistantDiv = createAssistantBubble();
    let fullText = '';

    await chatWithAI(message, (chunk) => {
      fullText += chunk;
      // Show text without actions block during streaming
      const displayText = fullText.split('---ACTIONS---')[0].trim();
      updateAssistantBubble(assistantDiv, displayText);
    });

    // Parse and execute actions
    const { text, actions } = parseAIResponse(fullText);

    // Update bubble with clean text (without actions JSON)
    updateAssistantBubble(assistantDiv, text);

    // Execute actions if any
    if (actions.length > 0) {
      const results = executeActions(actions);
      // Show action results in chat
      if (results.length > 0) {
        appendActionResults(results);
      }
      // Refresh task list
      renderAll();
    }

    // Save assistant message (text only, not actions JSON)
    store.addChatMessage({ role: 'assistant', content: text });
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

/**
 * Render all chat messages from history
 */
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

/**
 * Append a message to the chat
 */
function appendMessage(role, content, scroll = true) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // Remove welcome message if present
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

/**
 * Create an empty assistant bubble for streaming
 */
function createAssistantBubble() {
  const container = document.getElementById('chatMessages');
  if (!container) return null;

  removeTypingIndicator();

  const div = document.createElement('div');
  div.className = 'chat-message assistant';
  div.id = 'streamingMessage';
  div.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="chat-bubble" id="streamingBubble"></div>
  `;

  container.appendChild(div);
  scrollToBottom();
  return div;
}

/**
 * Update the streaming assistant bubble
 */
function updateAssistantBubble(div, text) {
  const bubble = document.getElementById('streamingBubble');
  if (bubble) {
    bubble.innerHTML = markdownToHtml(text);
    scrollToBottom();
  }
}

/**
 * Show typing indicator
 */
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

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Update send button state
 */
function updateSendButton() {
  const btn = document.getElementById('chatSendBtn');
  if (btn) {
    btn.disabled = isStreaming;
    btn.innerHTML = isStreaming ? '<div class="spinner" style="width:16px;height:16px;"></div>' : '➤';
  }
}

/**
 * Clear chat history
 */
export function clearChat() {
  store.clearChatHistory();
  renderChatMessages();
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ══════════════════════════════════════════════
   AI AGENT: Parse & Execute Actions
   ══════════════════════════════════════════════ */

/**
 * Parse AI response to separate text from action commands
 */
function parseAIResponse(fullText) {
  const marker = '---ACTIONS---';
  const markerIdx = fullText.indexOf(marker);

  if (markerIdx === -1) {
    return { text: fullText.trim(), actions: [] };
  }

  const text = fullText.substring(0, markerIdx).trim();
  const actionsStr = fullText.substring(markerIdx + marker.length).trim();

  try {
    // Extract JSON array from the actions string
    let jsonStr = actionsStr;

    // Remove markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Find array
    const arrStart = jsonStr.indexOf('[');
    const arrEnd = jsonStr.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1) {
      jsonStr = jsonStr.substring(arrStart, arrEnd + 1);
    }

    const actions = JSON.parse(jsonStr);
    return { text, actions: Array.isArray(actions) ? actions : [actions] };
  } catch (e) {
    console.warn('Failed to parse AI actions:', actionsStr, e);
    return { text, actions: [] };
  }
}

/**
 * Execute AI agent actions
 */
function executeActions(actions) {
  const results = [];

  for (const action of actions) {
    try {
      switch (action.action) {
        case 'create_task': {
          const task = createTask({
            title: action.title || 'Untitled Task',
            description: action.description || '',
            deadline: action.deadline || '',
            estimatedMinutes: action.estimatedMinutes || 60,
            category: action.category || 'other',
            priority: action.priority || 'medium',
            subtasks: action.subtasks || [],
          });
          results.push({ type: 'created', title: action.title, success: true });
          break;
        }

        case 'update_task': {
          if (!action.id) {
            results.push({ type: 'error', message: 'Missing task ID for update' });
            break;
          }
          const updated = updateTask(action.id, action.updates || {});
          if (updated) {
            results.push({ type: 'updated', title: updated.title, success: true });
          } else {
            results.push({ type: 'error', message: `Task not found: ${action.id}` });
          }
          break;
        }

        case 'delete_task': {
          if (!action.id) {
            results.push({ type: 'error', message: 'Missing task ID for delete' });
            break;
          }
          const task = store.getTask(action.id);
          if (task) {
            deleteTask(action.id);
            results.push({ type: 'deleted', title: task.title, success: true });
          } else {
            results.push({ type: 'error', message: `Task not found: ${action.id}` });
          }
          break;
        }

        case 'complete_task': {
          if (!action.id) {
            results.push({ type: 'error', message: 'Missing task ID for complete' });
            break;
          }
          const task = store.getTask(action.id);
          if (task) {
            if (!task.completed) toggleTask(action.id);
            results.push({ type: 'completed', title: task.title, success: true });
          } else {
            results.push({ type: 'error', message: `Task not found: ${action.id}` });
          }
          break;
        }

        default:
          results.push({ type: 'error', message: `Unknown action: ${action.action}` });
      }
    } catch (e) {
      console.error('Action execution error:', e);
      results.push({ type: 'error', message: e.message });
    }
  }

  return results;
}

/**
 * Show action results as visual badges in chat
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

