const Scanner = require("./scanner.js");
const Reader = require("./reader.js");
const { TokenName } = require("./token.js");

class Tokenizer {
  constructor(code) {
    this.scanner = new Scanner(code);
    this.trackRange = false;
    this.trackLoc = false;
    this.buffer = [];
    this.reader = new Reader();
  }

  getNextToken() {
    if (this.buffer.length === 0) {
      this.scanner.scanComments();
      if (!this.scanner.eof()) {
        let token = this.scanner.lex();
        this.reader.push(token);
        const entry = {
          type: TokenName[token.type],
          value: this.scanner.source.slice(token.start, token.end)
        };
        this.buffer.push(entry);
      }
    }
    return this.buffer.shift();
  }
}

module.exports = Tokenizer;
