const STORAGE = {
  conversation: 'miniWebAIConversation',
  metrics: 'miniWebAILabMetrics',
  theme: 'miniWebAITheme',
  mode: 'miniWebAIMode'
};

const state = {
  messages: loadJSON(STORAGE.conversation, []),
  sending: false
};

const conversation = document.querySelector('#conversation');
const emptyState = document.querySelector('#emptyState');
const form = document.querySelector('#chatForm');
const input = document.querySelector('#messageInput');
const sendButton = document.querySelector('#sendButton');
const status = document.querySelector('#status');
const modeSelect = document.querySelector('#modeSelect');
const mobileModeLabel = document.querySelector('#mobileModeLabel');
const mobileModeSelect = document.querySelector('#mobileModeSelect');

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveConversation() {
  localStorage.setItem(STORAGE.conversation, JSON.stringify(state.messages.slice(-60)));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch { return '#'; }
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;!?])/g, '$1<em>$2</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label, url) => `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  return html;
}

function renderTextBlocks(text) {
  const lines = text.split('\n');
  let html = '';
  let listType = null;

  const closeList = () => {
    if (listType) html += `</${listType}>`;
    listType = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      if (listType !== 'ul') { closeList(); listType = 'ul'; html += '<ul>'; }
      html += `<li>${inlineMarkdown(unordered[1])}</li>`;
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      if (listType !== 'ol') { closeList(); listType = 'ol'; html += '<ol>'; }
      html += `<li>${inlineMarkdown(ordered[1])}</li>`;
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      closeList();
      html += `<blockquote>${inlineMarkdown(quote[1])}</blockquote>`;
      continue;
    }

    closeList();
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  closeList();
  return html;
}

function renderMarkdown(markdown) {
  const parts = String(markdown || '').split(/```/);
  return parts.map((part, index) => {
    if (index % 2 === 0) return renderTextBlocks(part);
    const newline = part.indexOf('\n');
    const language = newline >= 0 ? part.slice(0, newline).trim() : '';
    const code = newline >= 0 ? part.slice(newline + 1) : part;
    const langClass = language ? ` data-language="${escapeHtml(language.slice(0, 20))}"` : '';
    return `<pre><code${langClass}>${escapeHtml(code.trimEnd())}</code></pre>`;
  }).join('');
}

function makeElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function appendSources(card, sources) {
  if (!Array.isArray(sources) || !sources.length) return;
  const wrap = makeElement('div', 'sources');
  wrap.appendChild(makeElement('div', 'sources-title', 'Fontes'));
  const list = makeElement('div', 'source-list');

  for (const source of sources) {
    const href = safeUrl(source.url);
    if (href === '#') continue;
    const entry = makeElement('div', 'source-entry');
    const a = makeElement('a', 'source-link', source.title || source.url);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = source.url;
    const urlText = makeElement('div', 'source-url', source.url);
    entry.append(a, urlText);
    list.appendChild(entry);
  }
  wrap.appendChild(list);
  card.appendChild(wrap);
}

function appendProcessing(card, p) {
  if (!p) return;
  const details = makeElement('details', 'processing');
  const summary = makeElement('summary', '', 'Detalhes do processamento');
  details.appendChild(summary);
  const grid = makeElement('div', 'processing-grid');
  const entries = [
    ['Rota utilizada', p.route || '—'],
    ['Internet utilizada', p.internetUsed ? 'Sim' : 'Não'],
    ['Modelo utilizado', p.modelUsed || 'nenhum'],
    ['Quantidade de fontes', p.sourceCount ?? 0],
    ['Tempo total', `${p.latency ?? 0} ms`],
    ['Tempo da pesquisa', `${p.searchTime ?? 0} ms`],
    ['Tempo do modelo', `${p.modelTime ?? 0} ms`],
    ['Tokens de entrada', p.tokensInput ?? 0],
    ['Tokens de saída', p.tokensOutput ?? 0],
    ['Cache', p.cache || 'MISS']
  ];

  for (const [label, value] of entries) {
    const row = document.createElement('div');
    row.append(document.createTextNode(`${label}: `));
    row.appendChild(makeElement('span', '', String(value)));
    grid.appendChild(row);
  }
  details.appendChild(grid);
  card.appendChild(details);
}

function createMessageView(message) {
  const wrapper = makeElement('article', `message ${message.role}`);
  const card = makeElement('div', 'message-card');
  const label = makeElement('div', 'message-label', message.role === 'user' ? 'Você' : 'Mini Web AI');
  const content = makeElement('div', 'message-content');

  if (message.role === 'assistant') content.innerHTML = renderMarkdown(message.content);
  else content.textContent = message.content;

  card.append(label, content);

  if (message.role === 'assistant') {
    appendSources(card, message.sources);
    const tools = makeElement('div', 'message-tools');
    const copy = makeElement('button', 'copy-button', 'Copiar resposta');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(message.content);
      copy.textContent = 'Copiado';
      setTimeout(() => { copy.textContent = 'Copiar resposta'; }, 1200);
    });
    tools.appendChild(copy);
    card.appendChild(tools);
    appendProcessing(card, message.processing);
  }

  wrapper.appendChild(card);
  return wrapper;
}

function renderConversation() {
  conversation.querySelectorAll('.message').forEach((el) => el.remove());
  if (emptyState) emptyState.classList.toggle('hidden', state.messages.length > 0);
  for (const message of state.messages) conversation.appendChild(createMessageView(message));
  scrollToBottom(false);
}

function scrollToBottom(smooth = true) {
  window.scrollTo({ top: document.body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function historyForApi() {
  return state.messages
    .filter((m) => ['user', 'assistant'].includes(m.role))
    .slice(-16)
    .map(({ role, content }) => ({ role, content }));
}

function likelyNeedsWeb(message) {
  return /\b(hoje|agora|atual|atualmente|últim[oa]|ultimo|ultima|recentemente|notícias|noticias|preço|preco|cotação|cotacao|resultado|placar|presidente atual|ceo atual|lançamento|lancamento|versão atual|versao atual|clima|previsão|previsao|investigue|confirme|verifique|valide)\b/i.test(message);
}

function setStatus(text) {
  status.textContent = text;
  status.classList.remove('hidden');
}

function hideStatus() { status.classList.add('hidden'); }

function updateMetrics(question, processing) {
  const metrics = loadJSON(STORAGE.metrics, {
    questions: 0,
    modelCalls: 0,
    webSearches: 0,
    locallyResolved: 0,
    cacheHits: 0,
    tokens: 0,
    totalLatency: 0,
    noModelRequests: 0,
    records: []
  });

  metrics.questions += 1;
  metrics.modelCalls += Number(processing.modelCalls || 0);
  metrics.webSearches += processing.internetUsed ? 1 : 0;
  metrics.locallyResolved += processing.locallyResolved ? 1 : 0;
  metrics.cacheHits += processing.cache === 'HIT' ? 1 : 0;
  metrics.tokens += Number(processing.tokensInput || 0) + Number(processing.tokensOutput || 0);
  metrics.totalLatency += Number(processing.latency || 0);
  metrics.noModelRequests += Number(processing.modelCalls || 0) === 0 ? 1 : 0;
  metrics.records.unshift({
    at: new Date().toISOString(),
    question: question.slice(0, 180),
    route: processing.route,
    web: processing.internetUsed,
    modelCalls: Number(processing.modelCalls || 0),
    cache: processing.cache,
    latency: Number(processing.latency || 0)
  });
  metrics.records = metrics.records.slice(0, 100);
  localStorage.setItem(STORAGE.metrics, JSON.stringify(metrics));
}

async function sendMessage(message) {
  if (state.sending || !message.trim()) return;
  state.sending = true;
  sendButton.disabled = true;

  const apiHistory = historyForApi();
  const userMessage = { role: 'user', content: message.trim() };
  state.messages.push(userMessage);
  saveConversation();
  renderConversation();
  setStatus('Analisando…');

  let webStatusTimer;
  if (likelyNeedsWeb(message)) {
    webStatusTimer = setTimeout(() => setStatus('Pesquisando na internet…'), 260);
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.trim(),
        history: apiHistory,
        mode: modeSelect.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);

    state.messages.push({
      role: 'assistant',
      content: data.answer,
      sources: data.sources || [],
      processing: data.processing || null
    });
    if (data.processing) updateMetrics(message, data.processing);
    saveConversation();
    renderConversation();
  } catch (error) {
    state.messages.push({
      role: 'assistant',
      content: `Não consegui processar a solicitação. ${error.message}`,
      sources: [],
      processing: null
    });
    saveConversation();
    renderConversation();
  } finally {
    clearTimeout(webStatusTimer);
    hideStatus();
    state.sending = false;
    sendButton.disabled = false;
    input.focus();
  }
}

function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE.theme, theme);
}

const initialTheme = localStorage.getItem(STORAGE.theme)
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(initialTheme);

modeSelect.value = localStorage.getItem(STORAGE.mode) || 'NORMAL';
mobileModeSelect.value = modeSelect.value;
mobileModeLabel.textContent = `Modo ${modeSelect.options[modeSelect.selectedIndex].text}`;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value;
  input.value = '';
  autosize();
  sendMessage(value);
});

input.addEventListener('input', autosize);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

function setMode(value) {
  modeSelect.value = value;
  mobileModeSelect.value = value;
  localStorage.setItem(STORAGE.mode, value);
  mobileModeLabel.textContent = `Modo ${modeSelect.options[modeSelect.selectedIndex].text}`;
}

modeSelect.addEventListener('change', () => setMode(modeSelect.value));
mobileModeSelect.addEventListener('change', () => setMode(mobileModeSelect.value));

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

document.querySelector('#themeToggle').addEventListener('click', toggleTheme);
document.querySelector('#mobileThemeToggle').addEventListener('click', toggleTheme);

function newConversation() {
  state.messages = [];
  saveConversation();
  renderConversation();
  input.focus();
}

document.querySelector('#newConversation').addEventListener('click', newConversation);
document.querySelector('#mobileNewConversation').addEventListener('click', newConversation);

function clearHistory() {
  if (!confirm('Limpar conversa e métricas do laboratório neste navegador?')) return;
  state.messages = [];
  localStorage.removeItem(STORAGE.conversation);
  localStorage.removeItem(STORAGE.metrics);
  renderConversation();
}

document.querySelector('#clearHistory').addEventListener('click', clearHistory);
document.querySelector('#mobileClearHistory').addEventListener('click', clearHistory);

document.querySelectorAll('.example').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.question || '';
    autosize();
    input.focus();
  });
});

renderConversation();
autosize();
