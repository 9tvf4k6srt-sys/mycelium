'use strict';

/** Sum the integers from 1 to n, inclusive. */
function sumRange(n) {
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += i;
  }
  return total;
}

module.exports = { sumRange };
