function hexValue(ch) {
  return "0123456789abcdef".indexOf(ch.toLowerCase());
}

function octalValue(ch) {
  return "01234567".indexOf(ch);
}

module.exports = {
  hexValue,
  octalValue
};
