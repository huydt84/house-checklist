module.exports = function (source) {
  const done = this.async();
  const swc = require("next/dist/build/swc");
  swc
    .transform(source, {
      filename: this.resourcePath,
      jsc: {
        parser: { syntax: "ecmascript", jsx: true },
        transform: { react: { runtime: "automatic" } },
      },
      module: { type: "es6" },
    })
    .then((result) => done(null, result.code), done);
};
