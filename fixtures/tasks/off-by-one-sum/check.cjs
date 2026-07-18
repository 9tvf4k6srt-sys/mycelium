'use strict';

const assert = require('node:assert');
const { sumRange } = require('./src/sum.cjs');

assert.strictEqual(sumRange(1), 1, 'sumRange(1)');
assert.strictEqual(sumRange(4), 10, 'sumRange(4)');
assert.strictEqual(sumRange(10), 55, 'sumRange(10)');
assert.strictEqual(sumRange(100), 5050, 'sumRange(100)');

console.log('checks passed');
