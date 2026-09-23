import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/calculator.js';

test('25 x 48', () => assert.equal(calculate('Quanto é 25 x 48?').value, 1200));
test('100 dividido por 4', () => assert.equal(calculate('100 dividido por 4').value, 25));
test('parentheses', () => assert.equal(calculate('(10 + 2) * 3').value, 36));
test('division by zero', () => assert.throws(() => calculate('10 / 0')));
