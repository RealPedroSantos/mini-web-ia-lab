import { routeQuestion, applyClassifierResult, needsMultipleSources } from '../src/router.js';
import { calculate } from '../src/calculator.js';
import { resolveLocal } from '../src/localResolver.js';
import { searchWeb, optimizeSearchQuery } from '../src/webSearch.js';
import { buildWebContext, modeConfig } from '../src/contextBuilder.js';
import { generateAnswer, classifyIntentWithSmallModel } from '../src/aiProvider.js';
import { getCache, setCache, makeCacheKey, ttlForQuestion, isContextDependent } from '../src/cache.js';
import { createProcessing, addModelUsage, logDecision } from '../src/metrics.js';
import { allowRequest } from '../src/rateLimit.js';

const MODES = new Set(['ECONOMICO', 'NORMAL', 'QUALIDADE']);

function setSecurityHeaders(res, req) {
  const allowed = process.env.ALLOWED_ORIGIN || '';
  const origin = req.headers.origin || '';
  if (allowed && origin === allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));
}

function cacheHitResponse(cached, started) {
  return {
    ...cached,
    searchedWeb: false,
    processing: {
      ...cached.processing,
      latency: Math.round(performance.now() - started),
      searchTime: 0,
      modelTime: 0,
      tokensInput: 0,
      tokensOutput: 0,
      modelCalls: 0,
      modelUsed: `cache (origem: ${cached.processing?.modelUsed || 'nenhum'})`,
      internetUsed: false,
      cache: 'HIT',
      locallyResolved: true
    }
  };
}

export default async function handler(req, res) {
  const started = performance.now();
  setSecurityHeaders(res, req);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const rate = allowRequest(req);
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  if (!rate.allowed) return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });

  const maxChars = Number(process.env.MAX_MESSAGE_CHARS || 4000);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const history = safeHistory(req.body?.history);
  const mode = MODES.has(req.body?.mode) ? req.body.mode : 'NORMAL';

  if (!message) return res.status(400).json({ error: 'A mensagem é obrigatória.' });
  if (message.length > maxChars) return res.status(413).json({ error: `Mensagem excede o limite de ${maxChars} caracteres.` });

  const canCache = !isContextDependent(message, history);
  const cacheKey = canCache ? makeCacheKey({ message, mode }) : null;
  const cached = cacheKey ? getCache(cacheKey) : null;
  if (cached) {
    const hit = cacheHitResponse(cached, started);
    logDecision({ query: message, processing: hit.processing, resultPreview: hit.answer });
    return res.json(hit);
  }

  let decision = routeQuestion(message);
  const processing = createProcessing({ route: decision.route });
  processing.routerReason = decision.reason;
  processing.routerConfidence = decision.confidence;

  const threshold = Number(process.env.ROUTER_LLM_CONFIDENCE_THRESHOLD || 0.58);
  const routerLlmEnabled = String(process.env.ROUTER_LLM_ENABLED || 'false').toLowerCase() === 'true';
  if (routerLlmEnabled && mode !== 'ECONOMICO' && decision.confidence < threshold) {
    try {
      const classified = await classifyIntentWithSmallModel(message);
      if (classified) {
        addModelUsage(processing, classified);
        decision = applyClassifierResult(decision, classified);
        processing.route = decision.route;
        processing.routerReason = decision.reason;
        processing.routerConfidence = decision.confidence;
      }
    } catch (error) {
      console.warn('Classificador pequeno indisponível:', error.message);
    }
  }

  let answer = '';
  let sources = [];
  let searchedWeb = false;

  try {
    if (decision.route === 'CALCULATION') {
      const result = calculate(message);
      answer = `**${result.answer}**`;
      processing.locallyResolved = true;
      processing.modelUsed = 'nenhum';
    } else {
      const local = resolveLocal(message);
      if (local.resolved) {
        answer = local.answer;
        processing.locallyResolved = true;
        processing.modelUsed = 'nenhum';
      } else if (decision.route === 'WEB_SEARCH') {
        const cfg = modeConfig(mode);
        const requestedSources = needsMultipleSources(message)
          ? Math.min(cfg.maxSources, mode === 'ECONOMICO' ? 3 : cfg.maxSources)
          : cfg.maxSources;
        const query = optimizeSearchQuery(message);
        processing.searchQuery = query;

        const searchStarted = performance.now();
        const web = await searchWeb(query, { count: requestedSources });
        processing.searchTime = Math.round(performance.now() - searchStarted);
        processing.internetUsed = true;
        searchedWeb = true;
        sources = web.results.slice(0, requestedSources);
        processing.sourceCount = sources.length;

        if (!sources.length) {
          answer = 'Não encontrei fontes suficientes para confirmar essa informação agora.';
          processing.locallyResolved = true;
        } else {
          const context = buildWebContext(sources, mode);
          const generated = await generateAnswer({ question: message, context, history, route: decision.route, mode });
          addModelUsage(processing, generated);
          answer = generated.text;
        }
      } else {
        const generated = await generateAnswer({ question: message, context: [], history, route: decision.route, mode });
        addModelUsage(processing, generated);
        answer = generated.text;
      }
    }
  } catch (error) {
    console.error(error);
    const isConfigError = /API_KEY|não configurada|não suportado/i.test(error.message);
    answer = searchedWeb
      ? 'A pesquisa foi iniciada, mas não consegui confirmar e sintetizar a resposta com segurança. Verifique a configuração das APIs e tente novamente.'
      : isConfigError
        ? `Configuração incompleta do laboratório: ${error.message}`
        : 'Ocorreu um erro ao processar a pergunta. Nenhuma fonte foi inventada.';
  }

  processing.latency = Math.round(performance.now() - started);
  const response = { answer, searchedWeb, sources, processing };

  if (cacheKey && answer && !/^Configuração incompleta|^Ocorreu um erro|^A pesquisa foi iniciada/.test(answer)) {
    setCache(cacheKey, response, ttlForQuestion(message, decision.route));
  }

  logDecision({ query: message, processing, resultPreview: answer });
  return res.json(response);
}
