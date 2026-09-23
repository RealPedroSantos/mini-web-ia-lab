function clip(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function modeConfig(mode) {
  const configs = {
    ECONOMICO: { maxSources: 3, snippetChars: 550, historyMessages: 4, historyChars: 2200, maxOutputTokens: 500 },
    NORMAL: { maxSources: 4, snippetChars: 750, historyMessages: 8, historyChars: 4200, maxOutputTokens: 800 },
    QUALIDADE: { maxSources: 5, snippetChars: 1100, historyMessages: 12, historyChars: 7000, maxOutputTokens: 1400 }
  };
  return configs[mode] || configs.NORMAL;
}

export function compactHistory(history = [], mode = 'NORMAL') {
  const cfg = modeConfig(mode);
  const safe = history
    .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-cfg.historyMessages)
    .map((m) => ({ role: m.role, content: clip(m.content, 1000) }));

  let total = 0;
  const reversed = [];
  for (const item of [...safe].reverse()) {
    if (total + item.content.length > cfg.historyChars) break;
    reversed.push(item);
    total += item.content.length;
  }
  return reversed.reverse();
}

export function buildWebContext(results = [], mode = 'NORMAL') {
  const cfg = modeConfig(mode);
  return results.slice(0, cfg.maxSources).map((item, index) => ({
    index: index + 1,
    title: clip(item.title, 180),
    snippet: clip(item.snippet, cfg.snippetChars),
    url: item.url,
    date: item.date || null
  }));
}

export function contextAsText(context = []) {
  return context.map((item) => [
    `[Fonte ${item.index}] ${item.title}`,
    item.date ? `Data/idade informada pela busca: ${item.date}` : null,
    `Trecho: ${item.snippet}`,
    `URL: ${item.url}`
  ].filter(Boolean).join('\n')).join('\n\n');
}
