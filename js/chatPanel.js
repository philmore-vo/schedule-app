/* ============================================
   TaskFlow AI — Chat Panel
   ============================================ */

import { store } from './store.js';
import { chatWithAI } from './aiService.js';
import { markdownToHtml } from './utils.js';

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
      updateAssistantBubble(assistantDiv, fullText);
    });

    // Save assistant message
    store.addChatMessage({ role: 'assistant', content: fullText });
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
