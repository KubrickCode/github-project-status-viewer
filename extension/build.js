const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");

const entryPoints = ["src/background.ts", "src/content.ts", "src/popup.ts"];

const buildOptions = {
  bundle: true,
  entryPoints,
  format: "iife",
  minify: !isWatch,
  outdir: "dist",
  sourcemap: isWatch,
  target: "es2020",
};

if (isWatch) {
  esbuild.context(buildOptions).then((ctx) => {
    ctx.watch();
    console.log("Watching for changes...");
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log("Build complete");
  });
}
