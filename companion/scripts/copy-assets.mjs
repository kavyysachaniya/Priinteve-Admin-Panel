// Copies the static renderer files (HTML, CSS, sample data, icons) next to the compiled JS.
import { cpSync, mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("dist/", root);

mkdirSync(new URL("renderer/", out), { recursive: true });
for (const file of ["index.html", "setup.html", "styles.css", "setup.css"]) {
  cpSync(new URL(`src/renderer/${file}`, root), new URL(`renderer/${file}`, out));
}
cpSync(new URL("assets/", root), new URL("assets/", out), { recursive: true });
