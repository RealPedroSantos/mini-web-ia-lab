function key(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[?!.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const fixedAnswers = new Map([
  ['quem descobriu o brasil', 'Na formulação histórica tradicional, a chegada da expedição portuguesa comandada por **Pedro Álvares Cabral**, em 1500, é chamada de “descobrimento do Brasil”. O território, porém, já era habitado por diversos povos indígenas muito antes da chegada portuguesa.'],
  ['qual e a capital do brasil', 'A capital do Brasil é **Brasília**.'],
  ['qual a capital do brasil', 'A capital do Brasil é **Brasília**.'],
  ['quanto tem um kilometro em metros', '1 quilômetro equivale a **1.000 metros**.'],
  ['quanto tem um quilometro em metros', '1 quilômetro equivale a **1.000 metros**.']
]);

export function resolveLocal(message) {
  const q = key(message);

  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|tudo bem|ola tudo bem)$/.test(q)) {
    return { resolved: true, answer: 'Olá! Como posso ajudar?', kind: 'greeting' };
  }

  if (/^(obrigado|obrigada|valeu|agradecido)$/.test(q)) {
    return { resolved: true, answer: 'Por nada. Se precisar, pode mandar a próxima pergunta.', kind: 'conversation' };
  }

  if (fixedAnswers.has(q)) {
    return { resolved: true, answer: fixedAnswers.get(q), kind: 'fixed_knowledge' };
  }

  return { resolved: false, answer: null, kind: null };
}
