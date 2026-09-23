function normalizeExpression(input) {
  return String(input)
    .toLowerCase()
    .replace(/quanto\s+(e|é)/g, '')
    .replace(/calcule|calcular|resultado de|qual o resultado de/g, '')
    .replace(/dividido\s+por/g, '/')
    .replace(/vezes|multiplicado\s+por/g, '*')
    .replace(/mais/g, '+')
    .replace(/menos/g, '-')
    .replace(/elevado\s+a|elevado\s+ao/g, '^')
    .replace(/[x×]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/,/g, '.')
    .replace(/[^0-9+\-*/^().%\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

class Parser {
  constructor(text) {
    this.text = text;
    this.i = 0;
  }

  parse() {
    const value = this.expression();
    this.skip();
    if (this.i !== this.text.length) throw new Error('Expressão inválida.');
    if (!Number.isFinite(value)) throw new Error('Resultado não finito.');
    return value;
  }

  skip() { while (/\s/.test(this.text[this.i] || '')) this.i += 1; }
  peek() { this.skip(); return this.text[this.i]; }
  take(char) { this.skip(); if (this.text[this.i] === char) { this.i += 1; return true; } return false; }

  expression() {
    let value = this.term();
    while (true) {
      if (this.take('+')) value += this.term();
      else if (this.take('-')) value -= this.term();
      else break;
    }
    return value;
  }

  term() {
    let value = this.power();
    while (true) {
      if (this.take('*')) value *= this.power();
      else if (this.take('/')) {
        const divisor = this.power();
        if (divisor === 0) throw new Error('Divisão por zero não é permitida.');
        value /= divisor;
      } else break;
    }
    return value;
  }

  power() {
    let value = this.unary();
    if (this.take('^')) value = value ** this.power();
    return value;
  }

  unary() {
    if (this.take('+')) return this.unary();
    if (this.take('-')) return -this.unary();
    return this.primary();
  }

  primary() {
    let value;
    if (this.take('(')) {
      value = this.expression();
      if (!this.take(')')) throw new Error('Parêntese não fechado.');
    } else {
      this.skip();
      const start = this.i;
      while (/[0-9.]/.test(this.text[this.i] || '')) this.i += 1;
      const raw = this.text.slice(start, this.i);
      if (!raw || (raw.match(/\./g) || []).length > 1) throw new Error('Número inválido.');
      value = Number(raw);
    }
    if (this.take('%')) value /= 100;
    return value;
  }
}

export function looksLikeCalculation(message) {
  const raw = String(message || '').toLowerCase();
  const hasNumber = /\d/.test(raw);
  const hasOperator = /[+\-*/^x×÷]|\b(mais|menos|vezes|dividido por|multiplicado por|elevado)\b/.test(raw);
  return hasNumber && hasOperator;
}

export function calculate(message) {
  const expression = normalizeExpression(message);
  if (!expression || expression.length > 120) throw new Error('Expressão matemática inválida.');
  const value = new Parser(expression).parse();
  const rounded = Math.abs(value) < 1e15 ? Number(value.toPrecision(12)) : value;
  return {
    expression,
    value: rounded,
    answer: String(rounded).replace('.', ',')
  };
}
