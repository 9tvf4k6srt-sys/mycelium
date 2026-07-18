'use strict';

/** Greeting for the user with the given id, looked up from an async repo. */
async function greet(userRepo, id) {
  const user = userRepo.getUser(id);
  return `hello ${user.name}`;
}

module.exports = { greet };
