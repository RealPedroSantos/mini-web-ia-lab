import { looksLikeCalculation } from './calculator.js';

const freshnessPatterns = [
  /\bhoje\b/i,
  /\bagora\b/i,
  /\batual(?:mente)?\b/i,
  /\bultim[oa]s?\b/i,
  /\brecentemente\b/i,
  /\bnot[ií]cias?\b/i,
  /\bpre[cç]o\b/i,
  /\bcota[cç][aã]o\b/i,
  /\bresultado\b/i,
  /\bplacar\b/i,
  /\bpresidente atual\b/i,
  /\bceo atual\b/i,
  /\blan[cç]amento\b/i,
  /\bvers[aã]o atual\b/i,
  /\bquem (?:e|é) o (?:atual )?(?:presidente|ceo|ministro|governador|prefeito)\b/i,
  /\bclima\b/i,
  /\btempo em\b/i,
  /\bprevis[aã]o do tempo\b/i
];

const multiSourcePatterns = [
  /\bcompare\b/i,
  /\bcomparar\b/i,
  /\binvestigue\b/i,
  /\bconfirme\b/i,
  /\bverifique\b/i,
  /\bvalide\b/i,
  /\bfontes\b/i,
  /\bverdade\b/i,
  /\breviews?\b/i,
  /\breclame aqui\b/i
];

export function isFreshnessSensitive(message) {
  return freshnessPatterns.some((pattern) => pattern.test(message));
}

export function needsMultipleSources(message) {
  return multiSourcePatterns.some((pattern) => pattern.test(message));
}

export function routeQuestion(message) {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();

  if (looksLikeCalculation(text)) {
    return { route: 'CALCULATION', confidence: 0.99, web: false, llm: false, reason: 'math_rule' };
  }

  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|e aí|e ai)[?!.\s]*$/i.test(text)) {
    return { route: 'CONVERSATION', confidence: 0.99, web: false, llm: false, reason: 'greeting_rule' };
  }

  if (isFreshnessSensitive(text) || needsMultipleSources(text)) {
    return {
      route: 'WEB_SEARCH',
      confidence: 0.94,
      web: true,
      llm: true,
      reason: isFreshnessSensitive(text) ? 'freshness_rule' : 'verification_rule'
    };
  }

  if (/\b(c[oó]digo|javascript|typescript|python|swift|java|php|sql|html|css|node\.?js|react|fun[cç][aã]o|api|regex|debug|erro de compila[cç][aã]o)\b/i.test(lower)) {
    return { route: 'CODE', confidence: 0.86, web: false, llm: true, reason: 'code_rule' };
  }

  if (/\b(detalhadamente|passo a passo|analise profundamente|racioc[ií]nio|demonstre|prove que|arquitetura completa|estrat[eé]gia|pr[oó]s e contras)\b/i.test(lower) || text.length > 700) {
    return { route: 'COMPLEX_REASONING', confidence: 0.84, web: false, llm: true, reason: 'complexity_rule' };
  }

  if (/^(obrigad[oa]|valeu|agradecido)[?!.\s]*$/i.test(text)) {
    return { route: 'CONVERSATION', confidence: 0.98, web: false, llm: false, reason: 'conversation_rule' };
  }

  const questionLike = /\?|^(quem|qual|quais|quando|onde|como|por que|porque|o que|explique|defina)\b/i.test(lower);
  if (questionLike) {
    return { route: 'DIRECT', confidence: 0.66, web: false, llm: true, reason: 'general_knowledge_rule' };
  }

  return { route: 'CONVERSATION', confidence: 0.52, web: false, llm: true, reason: 'fallback_ambiguous' };
}

export function applyClassifierResult(base, classified) {
  const allowed = new Set(['DIRECT', 'WEB_SEARCH', 'CALCULATION', 'CODE', 'CONVERSATION', 'COMPLEX_REASONING']);
  if (!classified || !allowed.has(classified.route)) return base;
  return {
    ...base,
    route: classified.route,
    confidence: Number.isFinite(classified.confidence) ? classified.confidence : base.confidence,
    web: classified.route === 'WEB_SEARCH',
    llm: !['CALCULATION'].includes(classified.route),
    reason: 'small_model_classifier'
  };
}
