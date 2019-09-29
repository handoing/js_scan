const fs = require("fs");
const path = require("path");
const { tokenize } = require('./src/index.js');

const jsFilePath = path.resolve(__dirname, './code.js');

fs.readFile(jsFilePath, "utf-8", function(error, data) {
  if (error) return console.log(error.message);
  const tokens = tokenize(data);
  console.log(tokens);
});