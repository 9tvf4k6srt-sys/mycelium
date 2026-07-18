'use strict';

const assert = require('node:assert');
const { sortAscending } = require('./src/sort.cjs');

assert.deepStrictEqual(sortAscending([3, 1, 2]), [1, 2, 3], 'small array');
assert.deepStrictEqual(sortAscending([5, -2, 9, 0, -7]), [-7, -2, 0, 5, 9], 'negatives');
assert.deepStrictEqual(sortAscending([4, 3, 2, 1]), [1, 2, 3, 4], 'reversed input');
assert.deepStrictEqual(sortAscending([42]), [42], 'single element');
assert.deepStrictEqual(sortAscending([]), [], 'empty input');

console.log('checks passed');
