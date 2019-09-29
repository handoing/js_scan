const Tokenizer = require("./tokenizer.js");

function tokenize(code) {
  const tokenizer = new Tokenizer(code);

  let tokens = [];

  try {
    while (true) {
      let token = tokenizer.getNextToken();
      if (!token) {
        break;
      }
      tokens.push(token);
    }
  } catch (e) {
    console.error(e);
  }

  return tokens;
}

module.exports = {
  tokenize
};
