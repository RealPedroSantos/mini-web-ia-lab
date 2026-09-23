const METRICS_KEY = 'miniWebAILabMetrics';
const THEME_KEY = 'miniWebAITheme';

function loadMetrics() {
  try {
    return JSON.parse(localStorage.getItem(METRICS_KEY)) || {};
  } catch { return {}; }
}

function number(value) { return Number(value || 0); }
function pct(value) { return `${Math.round(value * 100)}%`; }

function render() {
  const m = loadMetrics();
  const questions = number(m.questions);
  const modelCalls = number(m.modelCalls);
  const web = number(m.webSearches);
  const local = number(m.locallyResolved);
  const cache = number(m.cacheHits);
  const tokens = number(m.tokens);
  const average = questions ? Math.round(number(m.totalLatency) / questions) : 0;
  const localRate = questions ? local / questions : 0;
  const noModel = number(m.noModelRequests);
  const savings = questions ? noModel / questions : 0;

  document.querySelector('#metricQuestions').textContent = questions.toLocaleString('pt-BR');
  document.querySelector('#metricModelCalls').textContent = modelCalls.toLocaleString('pt-BR');
  document.querySelector('#metricWeb').textContent = web.toLocaleString('pt-BR');
  document.querySelector('#metricLocal').textContent = local.toLocaleString('pt-BR');
  document.querySelector('#metricCache').textContent = cache.toLocaleString('pt-BR');
  document.querySelector('#metricTokens').textContent = tokens.toLocaleString('pt-BR');
  document.querySelector('#metricLatency').textContent = `${average.toLocaleString('pt-BR')} ms`;
  document.querySelector('#metricLocalRate').textContent = pct(localRate);
  document.querySelector('#metricSavings').textContent = pct(savings);
  document.querySelector('#savingsBar').style.width = pct(savings);

  const tbody = document.querySelector('#decisionTable');
  tbody.replaceChildren();
  const records = Array.isArray(m.records) ? m.records : [];
  document.querySelector('#noRecords').classList.toggle('hidden', records.length > 0);

  for (const record of records) {
    const tr = document.createElement('tr');
    const cells = [
      new Date(record.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      record.question,
      record.route,
      record.web ? 'Sim' : 'Não',
      number(record.modelCalls) ? String(record.modelCalls) : 'Não',
      record.cache || 'MISS',
      `${number(record.latency)} ms`
    ];

    cells.forEach((value, index) => {
      const td = document.createElement('td');
      if (index === 2) {
        const badge = document.createElement('span');
        badge.className = 'route-badge';
        badge.textContent = value;
        td.appendChild(badge);
      } else {
        td.textContent = value;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

const theme = localStorage.getItem(THEME_KEY)
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;

document.querySelector('#resetMetrics').addEventListener('click', () => {
  if (!confirm('Zerar todas as métricas desta sessão?')) return;
  localStorage.removeItem(METRICS_KEY);
  render();
});

render();
