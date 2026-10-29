// Builds the prototype into one self-contained HTML page (for sharing as a link).
// Engineers normally use `npm run dev` (Vite) instead; see README.md.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const esbuildPath = process.env.ESBUILD_PATH || "esbuild";
const esbuild = require(esbuildPath);
const globalModules = execSync("npm root -g").toString().trim();
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const result = await esbuild.build({
  entryPoints: [path.join(root, "src/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: [path.join(root, "node_modules"), globalModules],
  logLevel: "warning",
  loader: { ".css": "empty" },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(path.join(root, "src/styles.css"), "utf8");

const page = `<title>Rabt Console</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script>
${js}
</script>
`;
mkdirSync(path.join(root, "dist"), { recursive: true });
writeFileSync(path.join(root, "dist/rabt-console.html"), page);
console.log("built dist/rabt-console.html", (page.length / 1024).toFixed(0) + " KB");
