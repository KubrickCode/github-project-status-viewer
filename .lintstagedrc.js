module.exports = {
  "extension/src/**/*.ts": () => "just lint extension",
  "server/**/*.go": () => "just lint server",
  "**/*.{json,yml,yaml,md}": () => "just lint config",
  justfile: () => "just lint justfile",
};
