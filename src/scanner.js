const Character = require("./character.js");
const { hexValue, octalValue } = require("./utils.js");
const { Token } = require("./token.js");

class Scanner {
  constructor(code) {
    this.source = code;
    this.trackComment = false;
    this.isModule = false;

    this.length = code.length;
    this.index = 0;
    this.lineNumber = code.length > 0 ? 1 : 0;
    this.lineStart = 0;
    this.curlyStack = [];
  }

  eof() {
    return this.index >= this.length;
  }

  lex() {
    if (this.eof()) {
      return {
        type: Token.EOF,
        value: "",
        lineNumber: this.lineNumber,
        lineStart: this.lineStart,
        start: this.index,
        end: this.index
      };
    }

    const cp = this.source.charCodeAt(this.index);

    if (Character.isIdentifierStart(cp)) {
      return this.scanIdentifier();
    }

    // 0x28 => (
    // 0x29 => )
    // 0x3b => ;
    if (cp === 0x28 || cp === 0x29 || cp === 0x3b) {
      return this.scanPunctuator();
    }

    // 0x22 => '
    // 0x27 => "
    if (cp === 0x27 || cp === 0x22) {
      return this.scanStringLiteral();
    }

    // 0x2e => .
    if (cp === 0x2e) {
      if (Character.isDecimalDigit(this.source.charCodeAt(this.index + 1))) {
        return this.scanNumericLiteral();
      }
      return this.scanPunctuator();
    }

    if (Character.isDecimalDigit(cp)) {
      return this.scanNumericLiteral();
    }

    // 0x60 => `
    // 0x7d => }
    if (
      cp === 0x60 ||
      (cp === 0x7d && this.curlyStack[this.curlyStack.length - 1] === "${")
    ) {
      return this.scanTemplate();
    }

    // Unicode 前导代理
    // https://zh.wikipedia.org/wiki/UTF-16
    if (cp >= 0xd800 && cp < 0xdfff) {
      if (Character.isIdentifierStart(this.codePointAt(this.index))) {
        return this.scanIdentifier();
      }
    }

    return this.scanPunctuator();
  }

  octalToDecimal() {
    let octal = ch !== "0";
    let code = octalValue(ch);

    if (
      !this.eof() &&
      Character.isOctalDigit(this.source.charCodeAt(this.index))
    ) {
      octal = true;
      code = code * 8 + octalValue(this.source[this.index++]);

      if (
        "0123".indexOf(ch) >= 0 &&
        !this.eof() &&
        Character.isOctalDigit(this.source.charCodeAt(this.index))
      ) {
        code = code * 8 + octalValue(this.source[this.index++]);
      }
    }

    return {
      code: code,
      octal: octal
    };
  }

  isImplicitOctalLiteral() {
    for (let i = this.index + 1; i < this.length; ++i) {
      const ch = this.source[i];
      if (ch === "8" || ch === "9") {
        return false;
      }
      if (!Character.isOctalDigit(ch.charCodeAt(0))) {
        return true;
      }
    }

    return true;
  }

  scanPunctuator() {
    const start = this.index;

    let str = this.source[this.index];
    switch (str) {
      case "(":
      case "{":
        if (str === "{") {
          this.curlyStack.push("{");
        }
        ++this.index;
        break;

      case ".":
        ++this.index;
        if (
          this.source[this.index] === "." &&
          this.source[this.index + 1] === "."
        ) {
          this.index += 2;
          str = "...";
        }
        break;

      case "}":
        ++this.index;
        this.curlyStack.pop();
        break;
      case ")":
      case ";":
      case ",":
      case "[":
      case "]":
      case ":":
      case "?":
      case "~":
        ++this.index;
        break;

      default:
        str = this.source.substr(this.index, 4);
        if (str === ">>>=") {
          this.index += 4;
        } else {
          str = str.substr(0, 3);
          if (
            str === "===" ||
            str === "!==" ||
            str === ">>>" ||
            str === "<<=" ||
            str === ">>=" ||
            str === "**="
          ) {
            this.index += 3;
          } else {
            str = str.substr(0, 2);
            if (
              str === "&&" ||
              str === "||" ||
              str === "==" ||
              str === "!=" ||
              str === "+=" ||
              str === "-=" ||
              str === "*=" ||
              str === "/=" ||
              str === "++" ||
              str === "--" ||
              str === "<<" ||
              str === ">>" ||
              str === "&=" ||
              str === "|=" ||
              str === "^=" ||
              str === "%=" ||
              str === "<=" ||
              str === ">=" ||
              str === "=>" ||
              str === "**"
            ) {
              this.index += 2;
            } else {
              str = this.source[this.index];
              if ("<>=!+-*%&|^/".indexOf(str) >= 0) {
                ++this.index;
              }
            }
          }
        }
    }

    if (this.index === start) {
      this.throwUnexpectedToken();
    }

    return {
      type: Token.Punctuator,
      value: str,
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanIdentifier() {
    let type;
    const start = this.index;

    // 0x5c => /
    const id =
      this.source.charCodeAt(start) === 0x5c
        ? this.getComplexIdentifier()
        : this.getIdentifier();

    if (id.length === 1) {
      type = Token.Identifier;
    } else if (this.isKeyword(id)) {
      type = Token.Keyword;
    } else if (id === "null") {
      type = Token.NullLiteral;
    } else if (id === "true" || id === "false") {
      type = Token.BooleanLiteral;
    } else {
      type = Token.Identifier;
    }

    if (type !== Token.Identifier && start + id.length !== this.index) {
      const restore = this.index;
      this.index = start;
      this.tolerateUnexpectedToken();
      this.index = restore;
    }

    return {
      type: type,
      value: id,
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanStringLiteral() {
    const start = this.index;
    let quote = this.source[start];

    ++this.index;
    let octal = false;
    let str = "";

    while (!this.eof()) {
      let ch = this.source[this.index++];

      if (ch === quote) {
        quote = "";
        break;
      } else if (ch === "\\") {
        ch = this.source[this.index++];
        if (!ch || !Character.isLineTerminator(ch.charCodeAt(0))) {
          switch (ch) {
            case "u":
              if (this.source[this.index] === "{") {
                ++this.index;
                str += this.scanUnicodeCodePointEscape();
              } else {
                const unescapedChar = this.scanHexEscape(ch);
                if (unescapedChar === null) {
                  this.throwUnexpectedToken();
                }
                str += unescapedChar;
              }
              break;
            case "x":
              const unescaped = this.scanHexEscape(ch);
              if (unescaped === null) {
                this.throwUnexpectedToken();
              }
              str += unescaped;
              break;
            case "n":
              str += "\n";
              break;
            case "r":
              str += "\r";
              break;
            case "t":
              str += "\t";
              break;
            case "b":
              str += "\b";
              break;
            case "f":
              str += "\f";
              break;
            case "v":
              str += "\x0B";
              break;
            case "8":
            case "9":
              str += ch;
              this.tolerateUnexpectedToken();
              break;

            default:
              if (ch && Character.isOctalDigit(ch.charCodeAt(0))) {
                const octToDec = this.octalToDecimal(ch);

                octal = octToDec.octal || octal;
                str += String.fromCharCode(octToDec.code);
              } else {
                str += ch;
              }
              break;
          }
        } else {
          ++this.lineNumber;
          if (ch === "\r" && this.source[this.index] === "\n") {
            ++this.index;
          }
          this.lineStart = this.index;
        }
      } else if (Character.isLineTerminator(ch.charCodeAt(0))) {
        break;
      } else {
        str += ch;
      }
    }

    if (quote !== "") {
      this.index = start;
      this.throwUnexpectedToken();
    }

    return {
      type: Token.StringLiteral,
      value: str,
      octal: octal,
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanTemplate() {
    let cooked = "";
    let terminated = false;
    const start = this.index;

    const head = this.source[start] === "`";
    let tail = false;
    let rawOffset = 2;

    ++this.index;

    while (!this.eof()) {
      let ch = this.source[this.index++];
      if (ch === "`") {
        rawOffset = 1;
        tail = true;
        terminated = true;
        break;
      } else if (ch === "$") {
        if (this.source[this.index] === "{") {
          this.curlyStack.push("${");
          ++this.index;
          terminated = true;
          break;
        }
        cooked += ch;
      } else if (ch === "\\") {
        ch = this.source[this.index++];
        if (!Character.isLineTerminator(ch.charCodeAt(0))) {
          switch (ch) {
            case "n":
              cooked += "\n";
              break;
            case "r":
              cooked += "\r";
              break;
            case "t":
              cooked += "\t";
              break;
            case "u":
              if (this.source[this.index] === "{") {
                ++this.index;
                cooked += this.scanUnicodeCodePointEscape();
              } else {
                const restore = this.index;
                const unescapedChar = this.scanHexEscape(ch);
                if (unescapedChar !== null) {
                  cooked += unescapedChar;
                } else {
                  this.index = restore;
                  cooked += ch;
                }
              }
              break;
            case "x":
              const unescaped = this.scanHexEscape(ch);
              if (unescaped === null) {
                this.throwUnexpectedToken();
              }
              cooked += unescaped;
              break;
            case "b":
              cooked += "\b";
              break;
            case "f":
              cooked += "\f";
              break;
            case "v":
              cooked += "\v";
              break;

            default:
              if (ch === "0") {
                if (
                  Character.isDecimalDigit(this.source.charCodeAt(this.index))
                ) {
                  this.throwUnexpectedToken();
                }
                cooked += "\0";
              } else if (Character.isOctalDigit(ch.charCodeAt(0))) {
                this.throwUnexpectedToken();
              } else {
                cooked += ch;
              }
              break;
          }
        } else {
          ++this.lineNumber;
          if (ch === "\r" && this.source[this.index] === "\n") {
            ++this.index;
          }
          this.lineStart = this.index;
        }
      } else if (Character.isLineTerminator(ch.charCodeAt(0))) {
        ++this.lineNumber;
        if (ch === "\r" && this.source[this.index] === "\n") {
          ++this.index;
        }
        this.lineStart = this.index;
        cooked += "\n";
      } else {
        cooked += ch;
      }
    }

    if (!terminated) {
      this.throwUnexpectedToken();
    }

    if (!head) {
      this.curlyStack.pop();
    }

    return {
      type: Token.Template,
      value: this.source.slice(start + 1, this.index - rawOffset),
      cooked: cooked,
      head: head,
      tail: tail,
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanHexLiteral() {
    let num = "";

    while (!this.eof()) {
      if (!Character.isHexDigit(this.source.charCodeAt(this.index))) {
        break;
      }
      num += this.source[this.index++];
    }

    if (num.length === 0) {
      this.throwUnexpectedToken();
    }

    if (Character.isIdentifierStart(this.source.charCodeAt(this.index))) {
      this.throwUnexpectedToken();
    }

    return {
      type: Token.NumericLiteral,
      value: parseInt("0x" + num, 16),
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanBinaryLiteral() {
    let num = "";
    let ch;

    while (!this.eof()) {
      ch = this.source[this.index];
      if (ch !== "0" && ch !== "1") {
        break;
      }
      num += this.source[this.index++];
    }

    if (num.length === 0) {
      this.throwUnexpectedToken();
    }

    if (!this.eof()) {
      ch = this.source.charCodeAt(this.index);
      /* istanbul ignore else */
      if (Character.isIdentifierStart(ch) || Character.isDecimalDigit(ch)) {
        this.throwUnexpectedToken();
      }
    }

    return {
      type: Token.NumericLiteral,
      value: parseInt(num, 2),
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanOctalLiteral() {
    let num = "";
    let octal = false;

    if (Character.isOctalDigit(prefix.charCodeAt(0))) {
      octal = true;
      num = "0" + this.source[this.index++];
    } else {
      ++this.index;
    }

    while (!this.eof()) {
      if (!Character.isOctalDigit(this.source.charCodeAt(this.index))) {
        break;
      }
      num += this.source[this.index++];
    }

    if (!octal && num.length === 0) {
      this.throwUnexpectedToken();
    }

    if (
      Character.isIdentifierStart(this.source.charCodeAt(this.index)) ||
      Character.isDecimalDigit(this.source.charCodeAt(this.index))
    ) {
      this.throwUnexpectedToken();
    }

    return {
      type: Token.NumericLiteral,
      value: parseInt(num, 8),
      octal: octal,
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanNumericLiteral() {
    const start = this.index;
    let ch = this.source[start];

    let num = "";
    if (ch !== ".") {
      num = this.source[this.index++];
      ch = this.source[this.index];

      if (num === "0") {
        if (ch === "x" || ch === "X") {
          ++this.index;
          return this.scanHexLiteral(start);
        }
        if (ch === "b" || ch === "B") {
          ++this.index;
          return this.scanBinaryLiteral(start);
        }
        if (ch === "o" || ch === "O") {
          return this.scanOctalLiteral(ch, start);
        }

        if (ch && Character.isOctalDigit(ch.charCodeAt(0))) {
          if (this.isImplicitOctalLiteral()) {
            return this.scanOctalLiteral(ch, start);
          }
        }
      }

      while (Character.isDecimalDigit(this.source.charCodeAt(this.index))) {
        num += this.source[this.index++];
      }
      ch = this.source[this.index];
    }

    if (ch === ".") {
      num += this.source[this.index++];
      while (Character.isDecimalDigit(this.source.charCodeAt(this.index))) {
        num += this.source[this.index++];
      }
      ch = this.source[this.index];
    }

    if (ch === "e" || ch === "E") {
      num += this.source[this.index++];

      ch = this.source[this.index];
      if (ch === "+" || ch === "-") {
        num += this.source[this.index++];
      }
      if (Character.isDecimalDigit(this.source.charCodeAt(this.index))) {
        while (Character.isDecimalDigit(this.source.charCodeAt(this.index))) {
          num += this.source[this.index++];
        }
      } else {
        this.throwUnexpectedToken();
      }
    }

    if (Character.isIdentifierStart(this.source.charCodeAt(this.index))) {
      this.throwUnexpectedToken();
    }

    return {
      type: Token.NumericLiteral,
      value: parseFloat(num),
      lineNumber: this.lineNumber,
      lineStart: this.lineStart,
      start: start,
      end: this.index
    };
  }

  scanHexEscape() {
    const len = prefix === "u" ? 4 : 2;
    let code = 0;

    for (let i = 0; i < len; ++i) {
      if (
        !this.eof() &&
        Character.isHexDigit(this.source.charCodeAt(this.index))
      ) {
        code = code * 16 + hexValue(this.source[this.index++]);
      } else {
        return null;
      }
    }
    return String.fromCharCode(code);
  }

  scanUnicodeCodePointEscape() {
    let ch = this.source[this.index];
    let code = 0;

    if (ch === "}") {
      this.throwUnexpectedToken();
    }

    while (!this.eof()) {
      ch = this.source[this.index++];
      if (!Character.isHexDigit(ch.charCodeAt(0))) {
        break;
      }
      code = code * 16 + hexValue(ch);
    }

    if (code > 0x10ffff || ch !== "}") {
      this.throwUnexpectedToken();
    }

    return Character.fromCodePoint(code);
  }

  throwUnexpectedToken() {}

  tolerateUnexpectedToken() {}

  getComplexIdentifier() {
    let cp = this.codePointAt(this.index);
    let id = Character.fromCodePoint(cp);
    this.index += id.length;

    let ch;
    if (cp === 0x5c) {
      if (this.source.charCodeAt(this.index) !== 0x75) {
        this.throwUnexpectedToken();
      }
      ++this.index;
      if (this.source[this.index] === "{") {
        ++this.index;
        ch = this.scanUnicodeCodePointEscape();
      } else {
        ch = this.scanHexEscape("u");
        if (
          ch === null ||
          ch === "\\" ||
          !Character.isIdentifierStart(ch.charCodeAt(0))
        ) {
          this.throwUnexpectedToken();
        }
      }
      id = ch;
    }

    while (!this.eof()) {
      cp = this.codePointAt(this.index);
      if (!Character.isIdentifierPart(cp)) {
        break;
      }
      ch = Character.fromCodePoint(cp);
      id += ch;
      this.index += ch.length;

      if (cp === 0x5c) {
        id = id.substr(0, id.length - 1);
        if (this.source.charCodeAt(this.index) !== 0x75) {
          this.throwUnexpectedToken();
        }
        ++this.index;
        if (this.source[this.index] === "{") {
          ++this.index;
          ch = this.scanUnicodeCodePointEscape();
        } else {
          ch = this.scanHexEscape("u");
          if (
            ch === null ||
            ch === "\\" ||
            !Character.isIdentifierPart(ch.charCodeAt(0))
          ) {
            this.throwUnexpectedToken();
          }
        }
        id += ch;
      }
    }

    return id;
  }

  getIdentifier() {
    const start = this.index++;
    while (!this.eof()) {
      const ch = this.source.charCodeAt(this.index);
      if (ch === 0x5c) {
        this.index = start;
        return this.getComplexIdentifier();
      } else if (ch >= 0xd800 && ch < 0xdfff) {
        this.index = start;
        return this.getComplexIdentifier();
      }
      if (Character.isIdentifierPart(ch)) {
        ++this.index;
      } else {
        break;
      }
    }

    return this.source.slice(start, this.index);
  }

  skipSingleLineComment() {
    let comments = [];
    let start, loc;

    if (this.trackComment) {
      comments = [];
      start = this.index - offset;
      loc = {
        start: {
          line: this.lineNumber,
          column: this.index - this.lineStart - offset
        },
        end: {}
      };
    }

    while (!this.eof()) {
      const ch = this.source.charCodeAt(this.index);
      ++this.index;
      if (Character.isLineTerminator(ch)) {
        if (this.trackComment) {
          loc.end = {
            line: this.lineNumber,
            column: this.index - this.lineStart - 1
          };
          const entry = {
            multiLine: false,
            slice: [start + offset, this.index - 1],
            range: [start, this.index - 1],
            loc: loc
          };
          comments.push(entry);
        }
        if (ch === 13 && this.source.charCodeAt(this.index) === 10) {
          ++this.index;
        }
        ++this.lineNumber;
        this.lineStart = this.index;
        return comments;
      }
    }

    if (this.trackComment) {
      loc.end = {
        line: this.lineNumber,
        column: this.index - this.lineStart
      };
      const entry = {
        multiLine: false,
        slice: [start + offset, this.index],
        range: [start, this.index],
        loc: loc
      };
      comments.push(entry);
    }

    return comments;
  }

  skipMultiLineComment() {
    let comments = [];
    let start, loc;

    if (this.trackComment) {
      comments = [];
      start = this.index - 2;
      loc = {
        start: {
          line: this.lineNumber,
          column: this.index - this.lineStart - 2
        },
        end: {}
      };
    }

    while (!this.eof()) {
      const ch = this.source.charCodeAt(this.index);
      if (Character.isLineTerminator(ch)) {
        if (ch === 0x0d && this.source.charCodeAt(this.index + 1) === 0x0a) {
          ++this.index;
        }
        ++this.lineNumber;
        ++this.index;
        this.lineStart = this.index;
      } else if (ch === 0x2a) {
        if (this.source.charCodeAt(this.index + 1) === 0x2f) {
          this.index += 2;
          if (this.trackComment) {
            loc.end = {
              line: this.lineNumber,
              column: this.index - this.lineStart
            };
            const entry = {
              multiLine: true,
              slice: [start + 2, this.index - 2],
              range: [start, this.index],
              loc: loc
            };
            comments.push(entry);
          }
          return comments;
        }
        ++this.index;
      } else {
        ++this.index;
      }
    }

    if (this.trackComment) {
      loc.end = {
        line: this.lineNumber,
        column: this.index - this.lineStart
      };
      const entry = {
        multiLine: true,
        slice: [start + 2, this.index],
        range: [start, this.index],
        loc: loc
      };
      comments.push(entry);
    }

    this.tolerateUnexpectedToken();
    return comments;
  }

  scanComments() {
    let comments;
    if (this.trackComment) {
      comments = [];
    }

    let start = this.index === 0;
    while (!this.eof()) {
      let ch = this.source.charCodeAt(this.index);

      if (Character.isWhiteSpace(ch)) {
        ++this.index;
      } else if (Character.isLineTerminator(ch)) {
        // 匹配换行符
        ++this.index;
        if (ch === 0x0d && this.source.charCodeAt(this.index) === 0x0a) {
          ++this.index;
        }
        ++this.lineNumber;
        this.lineStart = this.index;
        start = true;
      } else if (ch === 0x2f) {
        // 匹配 /
        ch = this.source.charCodeAt(this.index + 1);
        if (ch === 0x2f) {
          this.index += 2;
          const comment = this.skipSingleLineComment(2);
          if (this.trackComment) {
            comments = comments.concat(comment);
          }
          start = true;
        } else if (ch === 0x2a) {
          // 匹配 *
          this.index += 2;
          const comment = this.skipMultiLineComment();
          if (this.trackComment) {
            comments = comments.concat(comment);
          }
        } else {
          break;
        }
      } else if (start && ch === 0x2d) {
        // 匹配 -
        if (
          this.source.charCodeAt(this.index + 1) === 0x2d &&
          this.source.charCodeAt(this.index + 2) === 0x3e
        ) {
          this.index += 3;
          const comment = this.skipSingleLineComment(3);
          if (this.trackComment) {
            comments = comments.concat(comment);
          }
        } else {
          break;
        }
      } else if (ch === 0x3c && !this.isModule) {
        // 匹配 <
        if (this.source.slice(this.index + 1, this.index + 4) === "!--") {
          this.index += 4;
          const comment = this.skipSingleLineComment(4);
          if (this.trackComment) {
            comments = comments.concat(comment);
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return comments;
  }

  isKeyword(id) {
    switch (id.length) {
      case 2:
        return id === "if" || id === "in" || id === "do";
      case 3:
        return (
          id === "var" ||
          id === "for" ||
          id === "new" ||
          id === "try" ||
          id === "let"
        );
      case 4:
        return (
          id === "this" ||
          id === "else" ||
          id === "case" ||
          id === "void" ||
          id === "with" ||
          id === "enum"
        );
      case 5:
        return (
          id === "while" ||
          id === "break" ||
          id === "catch" ||
          id === "throw" ||
          id === "const" ||
          id === "yield" ||
          id === "class" ||
          id === "super"
        );
      case 6:
        return (
          id === "return" ||
          id === "typeof" ||
          id === "delete" ||
          id === "switch" ||
          id === "export" ||
          id === "import"
        );
      case 7:
        return id === "default" || id === "finally" || id === "extends";
      case 8:
        return id === "function" || id === "continue" || id === "debugger";
      case 10:
        return id === "instanceof";
      default:
        return false;
    }
  }

  codePointAt() {
    let cp = this.source.charCodeAt(i);

    if (cp >= 0xd800 && cp <= 0xdbff) {
      const second = this.source.charCodeAt(i + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        const first = cp;
        cp = (first - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
      }
    }

    return cp;
  }
}

module.exports = Scanner;
