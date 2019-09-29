const Token = {
  EOF: 'EOF',
  Punctuator: 'Punctuator',
  Keyword: 'Keyword',
  BooleanLiteral: 'BooleanLiteral',
  Identifier: 'Identifier',
  NullLiteral: 'NullLiteral',
  NumericLiteral: 'NumericLiteral',
  StringLiteral: 'StringLiteral',
  RegularExpression: 'RegularExpression',
  Template: 'Template'
};

let TokenName = {};
TokenName[Token.BooleanLiteral] = 'Boolean';
TokenName[Token.EOF] = '<end>';
TokenName[Token.Identifier] = 'Identifier';
TokenName[Token.Keyword] = 'Keyword';
TokenName[Token.NullLiteral] = 'Null';
TokenName[Token.NumericLiteral] = 'Numeric';
TokenName[Token.Punctuator] = 'Punctuator';
TokenName[Token.StringLiteral] = 'String';
TokenName[Token.RegularExpression] = 'RegularExpression';
TokenName[Token.Template] = 'Template';

module.exports = {
  Token,
  TokenName
};