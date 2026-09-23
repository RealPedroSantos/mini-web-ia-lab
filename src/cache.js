import crypto from 'node:crypto';

const store = new Map();
const MAX_ENTRIES = 500;

export function normalizeForCache(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeCacheKey({ message, mode }) {
  const raw = `${mode}|${normalizeForCache(message)}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function getCache(key) {
  const item = store.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    store.delete(key);
    return null;
  }
  return structuredClone(item.value);
}

export function setCache(key, value, ttlMs) {
  if (!key || ttlMs <= 0) return;
  if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, {
    value: structuredClone(value),
    expiresAt: Date.now() + ttlMs
  });
}

export function ttlForQuestion(message, route) {
  const q = normalizeForCache(message);
  if (/\b(cotacao|cambio|dolar|euro|bitcoin|preco)\b/.test(q)) return 60_000;
  if (/\b(hoje|agora|noticia|noticias|placar|resultado|clima|tempo|previsao|atual|atualmente|recente|recentemente)\b/.test(q)) return 5 * 60_000;
  if (route === 'WEB_SEARCH') return 5 * 60_000;
  if (route === 'CODE') return 6 * 60 * 60_000;
  if (route === 'DIRECT' || route === 'CALCULATION') return 24 * 60 * 60_000;
  return 60 * 60_000;
}

export function isContextDependent(message, history = []) {
  if (!history.length) return false;
  const q = normalizeForCache(message);
  return /\b(isso|isso ai|ele|ela|eles|elas|esse|essa|aquele|aquela|anterior|acima|continua|continue|explique melhor|e agora|e esse)\b/.test(q)
    || q.split(' ').length <= 3;
}
