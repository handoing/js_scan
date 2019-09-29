## 学习javascript词法分析

JavaScript => 词法分析 => Tokens

词法分析阶段是编译过程的第一个阶段，这个阶段的任务是从左到右一个字符一个字符地读入源程序，即对构成源程序的字符流进行扫描然后根据构词规则识别单词符号。

源代码：

```js
let num = 1 + 2.3;

function getHello (name) {
  return `Hello ${name}`;
}

getHello('han');

```

词法单元：

```js
[ { type: 'Keyword', value: 'let' },
  { type: 'Identifier', value: 'num' },
  { type: 'Punctuator', value: '=' },
  { type: 'Numeric', value: '1' },
  { type: 'Punctuator', value: '+' },
  { type: 'Numeric', value: '2.3' },
  { type: 'Punctuator', value: ';' },
  { type: 'Keyword', value: 'function' },
  { type: 'Identifier', value: 'getHello' },
  { type: 'Punctuator', value: '(' },
  { type: 'Identifier', value: 'name' },
  { type: 'Punctuator', value: ')' },
  { type: 'Punctuator', value: '{' },
  { type: 'Keyword', value: 'return' },
  { type: 'Template', value: '`Hello ${' },
  { type: 'Identifier', value: 'name' },
  { type: 'Template', value: '}`' },
  { type: 'Punctuator', value: ';' },
  { type: 'Punctuator', value: '}' },
  { type: 'Identifier', value: 'getHello' },
  { type: 'Punctuator', value: '(' },
  { type: 'String', value: '\'han\'' },
  { type: 'Punctuator', value: ')' },
  { type: 'Punctuator', value: ';' } ]
```