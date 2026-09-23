const PT_STOPWORDS = new Set([
  'a','o','as','os','um','uma','de','da','do','das','dos','e','ou','que','qual','quais','foi','foram','é','e','em','no','na','nos','nas','para','por','com','sobre','me','diga','pode','quando','aconteceu','relacionado','relacionada'
]);

export function optimizeSearchQuery(message, { currentYear = new Date().getUTCFullYear() } = {}) {
  const original = String(message || '').trim();
  const words = original
    .replace(/[?!,.;:()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !PT_STOPWORDS.has(word.toLowerCase()))
    .slice(0, 14);

  const hasFreshness = /\b(hoje|agora|atual|atualmente|últim[oa]|ultimo|ultima|recentemente|lançamento|lancamento|versão atual|versao atual|resultado|placar|preço|preco|cotação|cotacao)\b/i.test(original);
  const hasYear = words.some((w) => /^20\d{2}$/.test(w));
  if (hasFreshness && !hasYear) words.push(String(currentYear));

  return words.join(' ').slice(0, 280) || original.slice(0, 280);
}

async function braveSearch(query, count) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY não configurada.');

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(Math.max(count, 1), 10)));
  url.searchParams.set('country', process.env.WEB_SEARCH_COUNTRY || 'BR');
  url.searchParams.set('search_lang', process.env.WEB_SEARCH_LANG || 'pt-br');
  url.searchParams.set('safesearch', 'moderate');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey
    },
    signal: AbortSignal.timeout(8_000)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brave Search falhou (${response.status}): ${text.slice(0, 180)}`);
  }

  const data = await response.json();
  const results = (data?.web?.results || []).slice(0, count).map((item) => ({
    title: item.title || 'Sem título',
    url: item.url,
    snippet: item.description || '',
    date: item.page_age || item.age || null
  })).filter((item) => item.url);

  return { provider: 'brave', query, results };
}

export async function searchWeb(query, { count = 4 } = {}) {
  const provider = (process.env.WEB_SEARCH_PROVIDER || 'brave').toLowerCase();
  if (provider === 'brave') return braveSearch(query, count);
  throw new Error(`WEB_SEARCH_PROVIDER não suportado nesta versão: ${provider}`);
}
