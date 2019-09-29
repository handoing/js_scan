const { Token } = require("./token.js");

class Reader {
  constructor() {
    this.values = [];
    this.curly = -1;
    this.paren = -1;
  }

  push(token) {
    if (token.type === Token.Punctuator || token.type === Token.Keyword) {
      if (token.value === "{") {
        this.curly = this.values.length;
      } else if (token.value === "(") {
        this.paren = this.values.length;
      }
      this.values.push(token.value);
    } else {
      this.values.push(null);
    }
  }
}

module.exports = Reader;
