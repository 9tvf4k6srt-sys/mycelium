'use strict';

const assert = require('node:assert');
const { totalWithDiscount } = require('./src/price.cjs');

// Expected values assume a single rounding of the TOTAL (never per-unit).
assert.strictEqual(totalWithDiscount(1095, 2, 0.1), 1971, '10% off 2x1095');
assert.strictEqual(totalWithDiscount(499, 5, 0.25), 1871, '25% off 5x499');
assert.strictEqual(totalWithDiscount(2599, 3, 0.15), 6627, '15% off 3x2599');
assert.strictEqual(totalWithDiscount(1000, 1, 0), 1000, 'no discount');

console.log('checks passed');
