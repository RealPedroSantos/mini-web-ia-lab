import test from 'node:test';
import assert from 'node:assert/strict';
import { routeQuestion } from '../src/router.js';

const cases = [
  ['Quanto é 25 x 48?', 'CALCULATION'],
  ['Quem descobriu o Brasil?', 'DIRECT'],
  ['Quem é o atual presidente da Argentina?', 'WEB_SEARCH'],
  ['Qual foi o resultado do jogo do Flamengo hoje?', 'WEB_SEARCH'],
  ['Faça um código JavaScript para ordenar uma lista.', 'CODE'],
  ['Explique relatividade geral detalhadamente.', 'COMPLEX_REASONING'],
  ['Olá', 'CONVERSATION']
];

for (const [query, expected] of cases) {
  test(`${query} -> ${expected}`, () => {
    assert.equal(routeQuestion(query).route, expected);
  });
}
