'use strict';

/** Return a new array with the numbers sorted ascending. */
function sortAscending(values) {
  return [...values].sort((a, b) => a > b);
}

module.exports = { sortAscending };
