export function createProcessing({ route = 'DIRECT' } = {}) {
  return {
    route,
    latency: 0,
    modelUsed: 'nenhum',
    modelsUsed: [],
    modelCalls: 0,
    internetUsed: false,
    sourceCount: 0,
    searchTime: 0,
    modelTime: 0,
    tokensInput: 0,
    tokensOutput: 0,
    cache: 'MISS',
    locallyResolved: false,
    routerReason: null,
    routerConfidence: null,
    searchQuery: null
  };
}

export function addModelUsage(processing, usage) {
  if (!usage) return;
  processing.modelCalls += 1;
  processing.modelTime += usage.latency || 0;
  processing.modelsUsed.push(usage.model);
  processing.modelUsed = processing.modelsUsed.join(' + ');
  processing.tokensInput += Number(usage.tokens?.input || 0);
  processing.tokensOutput += Number(usage.tokens?.output || 0);
}

export function logDecision({ query, processing, resultPreview }) {
  const record = {
    query: String(query).slice(0, 300),
    route: processing.route,
    web: processing.internetUsed,
    llm: processing.modelCalls > 0,
    cache: processing.cache,
    result: String(resultPreview || '').slice(0, 180)
  };
  console.log(`[decision] ${JSON.stringify(record)}`);
}
