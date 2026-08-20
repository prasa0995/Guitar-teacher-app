import { api, h } from '../app.js';

const SUGGESTIONS = [
  'What is a G chord?',
  'Why does my C chord sound muted?',
  'What does 4/4 mean?',
  'Give me a 15-minute practice session',
  'Test me on the chords I learned',
];

// Current screen context — other views can call setScreenContext() so the
// AI answers with awareness of what's on screen (e.g. current song).
let screenContext = { screen: 'home' };
export function setScreenContext(ctx) { screenContext = ctx; }

export function mount() {
  const fab = h('button', { id: 'ai-fab', title: 'Ask your AI guitar teacher' }, '💬');
  const panel = h('div', { id: 'ai-panel' });
  const header = h('div', { class: 'ai-header' }, [
    h('span', {}, '🎸 AI Guitar Teacher'),
    h('button', { class: 'ghost', style: 'padding:2px 8px;', onclick: () => panel.classList.remove('open') }, '✕'),
  ]);
  const messages = h('div', { id: 'ai-messages' });
  const suggestions = h('div', { class: 'ai-suggestions' });
  SUGGESTIONS.forEach((s) => {
    suggestions.appendChild(h('button', { class: 'ghost', onclick: () => sendMessage(s) }, s));
  });
  const input = h('input', { placeholder: 'Ask anything about guitar…' });
  const form = h('form', { id: 'ai-form', onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) { sendMessage(input.value.trim()); input.value = ''; } } }, [
    input, h('button', { class: 'primary', type: 'submit' }, 'Send'),
  ]);

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(suggestions);
  panel.appendChild(form);

  fab.onclick = () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) loadHistory();
  };

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  async function loadHistory() {
    if (messages.dataset.loaded) return;
    messages.dataset.loaded = '1';
    try {
      const { messages: history } = await api('/ai/conversation');
      history.slice(-10).forEach((m) => appendMsg(m.role, m.content, m.source));
      if (!history.length) {
        appendMsg('assistant', "Hi! I'm your AI guitar teacher. Ask me about a chord, a technique, or say \"give me a practice session\" — I'll tailor it to what you've learned so far.");
      }
    } catch (e) { /* not logged in yet */ }
  }

  function appendMsg(role, content, source) {
    const bubble = h('div', { class: `ai-msg ${role}` }, content);
    messages.appendChild(bubble);
    if (role === 'assistant' && source) {
      messages.appendChild(h('div', { class: 'badge-source' }, source === 'anthropic' ? '✨ AI-generated' : '📘 built-in guitar knowledge'));
    }
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(text) {
    appendMsg('user', text);
    const thinking = h('div', { class: 'ai-msg assistant' }, '…thinking');
    messages.appendChild(thinking);
    messages.scrollTop = messages.scrollHeight;
    try {
      const res = await api('/ai/chat', { method: 'POST', body: { message: text, screenContext } });
      thinking.remove();
      appendMsg('assistant', res.reply, res.source);
    } catch (e) {
      thinking.remove();
      appendMsg('assistant', `Sorry, I hit an error: ${e.message}`);
    }
  }
}
