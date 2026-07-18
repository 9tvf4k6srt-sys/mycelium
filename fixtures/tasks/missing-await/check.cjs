'use strict';

const assert = require('node:assert');
const { greet } = require('./src/greet.cjs');

const repo = {
  getUser: async (id) => ({ id, name: 'ada' }),
};

async function main() {
  assert.strictEqual(await greet(repo, 7), 'hello ada', 'greet(7)');
  assert.strictEqual(await greet(repo, 42), 'hello ada', 'greet(42)');
  console.log('checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
