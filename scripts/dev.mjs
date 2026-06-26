// Lançador de desenvolvimento: sobe API (FastAPI) + Web (Vite) e abre o navegador.
// Robusto: não depende do depurador de navegador do VS Code e detecta a porta
// real do Vite (caso a 5173 esteja ocupada).
import { spawn, exec } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = platform() === "win32";
const FALLBACK_URL = "http://localhost:5173";

// Python do venv da API (cai para "python" se o venv não existir).
const pyWin = join(root, "apps", "api", ".venv", "Scripts", "python.exe");
const pyNix = join(root, "apps", "api", ".venv", "bin", "python");
const python = existsSync(pyWin) ? pyWin : existsSync(pyNix) ? pyNix : "python";

// Vite via seu entry JS (evita problemas com .cmd e caminhos com espaços).
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");

const procs = [];
let browserOpened = false;

function openBrowser(url) {
  if (browserOpened || process.env.NO_OPEN) return;
  browserOpened = true;
  console.log(`\x1b[36m🌐 Abrindo ${url}\x1b[0m`);
  const cmd = isWin
    ? `start "" "${url}"`
    : platform() === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd);
}

console.log("\x1b[36m▶ Volley Manager — subindo API + Web...\x1b[0m");

// API (FastAPI)
console.log("\x1b[33m[api]\x1b[0m iniciando na porta 8000...");
const api = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
  { cwd: join(root, "apps", "api"), env: { ...process.env, ENV: "development" }, stdio: "inherit" },
);
api.on("error", (e) => console.log(`\x1b[31m[api] erro: ${e.message}\x1b[0m`));
api.on("exit", (code) => {
  if (code) console.log(`\x1b[31m[api] encerrou (código ${code}). A 8000 já está em uso?\x1b[0m`);
});
procs.push(api);

// Web (Vite) — captura stdout para descobrir a porta real e abrir o navegador.
if (existsSync(viteBin)) {
  console.log("\x1b[33m[web]\x1b[0m iniciando Vite...");
  const web = spawn(process.execPath, [viteBin], {
    cwd: join(root, "apps", "web"),
    stdio: ["inherit", "pipe", "inherit"],
  });
  web.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
    const match = clean.match(/Local:\s*(http:\/\/[^\s/]+)/i);
    if (match) openBrowser(match[1] + "/");
  });
  web.on("error", (e) => console.log(`\x1b[31m[web] erro: ${e.message}\x1b[0m`));
  procs.push(web);
} else {
  console.log("\x1b[31mVite não encontrado. Rode `npm install` na raiz primeiro.\x1b[0m");
}

// Rede de segurança: se não detectarmos a porta em 10s, tenta a padrão.
setTimeout(() => openBrowser(FALLBACK_URL), 10_000);

function shutdown() {
  console.log("\n\x1b[36mEncerrando Volley Manager...\x1b[0m");
  for (const p of procs) {
    try {
      p.kill();
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
