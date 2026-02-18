#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

type TunnelState = {
  hostname: string;
  localLog: string;
  port: number;
  session: string;
  tunnelLog: string;
  tunnelName: string;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, "..");
const WEB_DIR = resolve(ROOT_DIR, "apps/web");
const PROJECT_NAME = basename(ROOT_DIR);

const DEFAULT_DOMAIN_SUFFIX = "aidanaden.com";
const DEFAULT_TUNNEL_NAME = `${sanitizeDnsLabel(PROJECT_NAME) || PROJECT_NAME}-dev`;
const DEFAULT_ACTION = "restart";
const ACTION = (process.argv[2] ?? DEFAULT_ACTION).trim().toLowerCase();

const SESSION = process.env.DEV_TUNNEL_SESSION?.trim() || `${PROJECT_NAME}-tunnel`;
const STATE_FILE = process.env.DEV_TUNNEL_STATE_FILE?.trim() || `/tmp/${PROJECT_NAME}-dev-tunnel-state.json`;

function printHelp(): void {
  console.log(`Usage: bun ./scripts/dev-tunnel.ts [start|stop|restart|status|logs]

Defaults to "restart" so running "bun run dev:tunnel" will restart the tmux tunnel session.

Environment variables:
  DEV_TUNNEL_SESSION        Tmux session name (default: ${SESSION}).
  DEV_TUNNEL_PORT           Preferred local port. Falls back if busy.
  DEV_TUNNEL_PORT_START     Port scan start (default: 4330).
  DEV_TUNNEL_PORT_END       Port scan end (default: 4399).
  DEV_TUNNEL_DOMAIN_SUFFIX  Hostname suffix (default: ${DEFAULT_DOMAIN_SUFFIX}).
  DEV_TUNNEL_PROJECT_NAME   Project name used in hostname (default: repo folder name).
  DEV_TUNNEL_HOSTNAME       Full hostname override (must end with .<domain suffix>).
  DEV_TUNNEL_NAME           Named tunnel name (default: ${DEFAULT_TUNNEL_NAME}).
  CLOUDFLARED_TUNNEL_NAME   Backward-compatible tunnel name env.
  DEV_TUNNEL_TOKEN          Optional tunnel token override.
  DEV_TUNNEL_TOKEN_FILE     Token file path override.
  DEV_TUNNEL_LOG_FILE       Local dev server log path.
  DEV_TUNNEL_CLOUDFLARED_LOG Cloudflared log path.
`);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parsePort(name: string, rawValue: string): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid ${name}: ${rawValue}`);
  }
  return parsed;
}

function sanitizeDnsLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function runCommand(command: string, args: string[], options?: { ignoreFailure?: boolean }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!options?.ignoreFailure && result.status !== 0) {
    const details = (result.stderr || result.stdout).trim();
    throw new Error(details || `${command} ${args.join(" ")} failed`);
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function commandExists(command: string): boolean {
  const result = spawnSync("which", [command], { stdio: "ignore" });
  return result.status === 0;
}

function requireCommand(command: string): void {
  if (!commandExists(command)) {
    throw new Error(`Missing required command: ${command}`);
  }
}

function hasSession(): boolean {
  const result = runCommand("tmux", ["has-session", "-t", SESSION], { ignoreFailure: true });
  return result.status === 0;
}

function ensureTunnelExists(tunnelName: string): void {
  const result = runCommand("cloudflared", ["tunnel", "info", tunnelName], { ignoreFailure: true });
  if (result.status === 0) {
    return;
  }

  const credName = sanitizeDnsLabel(tunnelName) || "named-tunnel";
  const credentialsFile = `/tmp/${PROJECT_NAME}-cloudflared-credentials-${credName}.json`;
  mkdirSync(dirname(credentialsFile), { recursive: true });

  console.log(`Creating named tunnel: ${tunnelName}`);
  runCommand("cloudflared", ["tunnel", "create", "--credentials-file", credentialsFile, tunnelName]);
}

function readState(): TunnelState | null {
  if (!existsSync(STATE_FILE)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<TunnelState>;
    if (
      typeof parsed.port === "number" &&
      typeof parsed.hostname === "string" &&
      typeof parsed.tunnelName === "string" &&
      typeof parsed.localLog === "string" &&
      typeof parsed.tunnelLog === "string" &&
      typeof parsed.session === "string"
    ) {
      return parsed as TunnelState;
    }
  } catch {
    // Ignore invalid state file and treat as missing.
  }

  return null;
}

function writeState(state: TunnelState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function canBindOnHost(port: number, host: "127.0.0.1" | "::1"): Promise<boolean> {
  return await new Promise<boolean>((resolveResult) => {
    const server = createServer();
    let settled = false;

    const settle = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolveResult(value);
    };

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        settle(false);
        return;
      }
      if (error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL") {
        settle(true);
        return;
      }
      settle(false);
    });

    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => settle(true));
    });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  const [ipv4Available, ipv6Available] = await Promise.all([
    canBindOnHost(port, "127.0.0.1"),
    canBindOnHost(port, "::1"),
  ]);
  return ipv4Available && ipv6Available;
}

async function findOpenPort(start: number, end: number): Promise<number | null> {
  for (let port = start; port <= end; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return null;
}

function makeHostname(): string {
  const rawSuffix = (process.env.DEV_TUNNEL_DOMAIN_SUFFIX?.trim() || DEFAULT_DOMAIN_SUFFIX)
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  if (!rawSuffix) {
    throw new Error("DEV_TUNNEL_DOMAIN_SUFFIX must not be empty");
  }

  const projectNameRaw = process.env.DEV_TUNNEL_PROJECT_NAME?.trim() || PROJECT_NAME;
  const sanitizedProjectName = sanitizeDnsLabel(projectNameRaw) || PROJECT_NAME;
  const defaultLabel = sanitizedProjectName.endsWith("-dev")
    ? sanitizedProjectName
    : `${sanitizedProjectName}-dev`;
  const defaultHostname = `${defaultLabel}.${rawSuffix}`;
  const hostname = (process.env.DEV_TUNNEL_HOSTNAME?.trim() || defaultHostname).toLowerCase();
  const requiredSuffix = `.${rawSuffix}`;
  if (!hostname.endsWith(requiredSuffix)) {
    throw new Error(`Tunnel hostname must end with ${requiredSuffix}, got: ${hostname}`);
  }
  return hostname;
}

async function resolvePort(): Promise<number> {
  const portStart = parsePort("DEV_TUNNEL_PORT_START", process.env.DEV_TUNNEL_PORT_START ?? "4330");
  const portEnd = parsePort("DEV_TUNNEL_PORT_END", process.env.DEV_TUNNEL_PORT_END ?? "4399");
  if (portStart > portEnd) {
    throw new Error(`DEV_TUNNEL_PORT_START must be <= DEV_TUNNEL_PORT_END (${portStart} > ${portEnd})`);
  }

  if (process.env.DEV_TUNNEL_PORT) {
    const preferredPort = parsePort("DEV_TUNNEL_PORT", process.env.DEV_TUNNEL_PORT);
    if (await isPortAvailable(preferredPort)) {
      return preferredPort;
    }
    console.log(`Port ${preferredPort} is in use, searching for another free port...`);
  }

  const openPort = await findOpenPort(portStart, portEnd);
  if (openPort === null) {
    throw new Error(`No free local port found in range ${portStart}-${portEnd}`);
  }
  return openPort;
}

async function getStatusCode(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return String(response.status);
  } catch {
    return "000";
  }
}

function getCloudflareEdgeIp(hostname: string): string | null {
  const dig = runCommand("dig", ["@1.1.1.1", "+short", hostname], { ignoreFailure: true });
  if (dig.status !== 0) {
    return null;
  }

  const line = dig.stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(value));
  return line ?? null;
}

function getEdgeStatusCode(hostname: string): string {
  const ip = getCloudflareEdgeIp(hostname);
  if (!ip) {
    return "000";
  }

  const url = `https://${hostname}`;
  const resolveValue = `${hostname}:443:${ip}`;
  const curl = runCommand(
    "curl",
    ["-sS", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "8", "--resolve", resolveValue, url],
    { ignoreFailure: true },
  );
  const code = curl.stdout.trim();
  if (/^[0-9]{3}$/.test(code)) {
    return code;
  }
  return "000";
}

function printFileTail(path: string, lineCount: number): void {
  if (!existsSync(path)) {
    console.log("missing");
    return;
  }

  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const output = lines.slice(-lineCount).join("\n");
  if (output) {
    console.log(output);
  }
}

async function statusSession(): Promise<void> {
  requireCommand("tmux");

  if (!hasSession()) {
    console.log(`Session ${SESSION}: not running`);
    process.exit(1);
  }

  console.log(`Session ${SESSION}: running`);
  const windows = runCommand("tmux", ["list-windows", "-t", SESSION]);
  process.stdout.write(windows.stdout);

  const state = readState();
  if (!state) {
    console.log(`State file missing: ${STATE_FILE}`);
    return;
  }

  const localCode = await getStatusCode(`http://localhost:${state.port}`);
  console.log(`Local http://localhost:${state.port}: ${localCode}`);

  const edgeCode = getEdgeStatusCode(state.hostname);
  console.log(`Edge https://${state.hostname}: ${edgeCode}`);
  console.log(`Local log: ${state.localLog}`);
  console.log(`Tunnel log: ${state.tunnelLog}`);
}

function stopSession(): void {
  requireCommand("tmux");
  if (hasSession()) {
    runCommand("tmux", ["kill-session", "-t", SESSION]);
    console.log(`Stopped ${SESSION}`);
  } else {
    console.log(`Session ${SESSION} is not running.`);
  }
}

async function startSession(): Promise<void> {
  requireCommand("tmux");
  requireCommand("bun");
  requireCommand("cloudflared");
  requireCommand("curl");

  if (hasSession()) {
    console.log(`Session ${SESSION} is already running.`);
    await statusSession();
    return;
  }

  const hostname = makeHostname();
  const tunnelName =
    process.env.DEV_TUNNEL_NAME?.trim() ||
    process.env.CLOUDFLARED_TUNNEL_NAME?.trim() ||
    DEFAULT_TUNNEL_NAME;
  if (!tunnelName) {
    throw new Error("Tunnel name is required (DEV_TUNNEL_NAME or CLOUDFLARED_TUNNEL_NAME)");
  }
  ensureTunnelExists(tunnelName);

  const port = await resolvePort();
  const localLog = process.env.DEV_TUNNEL_LOG_FILE?.trim() || `/tmp/${PROJECT_NAME}-local-web-${port}.log`;
  const tunnelLog =
    process.env.DEV_TUNNEL_CLOUDFLARED_LOG?.trim() || `/tmp/${PROJECT_NAME}-cloudflared-${port}.log`;
  const tokenName = sanitizeDnsLabel(tunnelName) || "named-tunnel";
  const tokenFile =
    process.env.DEV_TUNNEL_TOKEN_FILE?.trim() || `/tmp/${PROJECT_NAME}-cloudflared-token-${tokenName}.txt`;
  mkdirSync(dirname(localLog), { recursive: true });
  mkdirSync(dirname(tunnelLog), { recursive: true });
  mkdirSync(dirname(tokenFile), { recursive: true });

  runCommand("cloudflared", ["tunnel", "route", "dns", "--overwrite-dns", tunnelName, hostname]);

  const tunnelToken =
    process.env.DEV_TUNNEL_TOKEN?.trim() || runCommand("cloudflared", ["tunnel", "token", tunnelName]).stdout.trim();
  if (!tunnelToken) {
    throw new Error(`Failed to resolve token for tunnel: ${tunnelName}`);
  }
  writeFileSync(tokenFile, `${tunnelToken}\n`, { encoding: "utf8", mode: 0o600 });

  const localCommand = `cd ${shellQuote(WEB_DIR)} && while true; do bun run vite dev --port ${shellQuote(String(port))} >>${shellQuote(localLog)} 2>&1; echo '[local exited]' >>${shellQuote(localLog)}; sleep 1; done`;
  const tunnelCommand = `while ! curl -fsS --max-time 2 http://localhost:${port} >/dev/null 2>&1; do sleep 0.2; done; while true; do cloudflared tunnel --url ${shellQuote(`http://localhost:${port}`)} --http-host-header ${shellQuote(`localhost:${port}`)} --no-autoupdate run --token-file ${shellQuote(tokenFile)} >>${shellQuote(tunnelLog)} 2>&1; echo '[tunnel exited]' >>${shellQuote(tunnelLog)}; sleep 2; done`;

  writeFileSync(localLog, "", "utf8");
  writeFileSync(tunnelLog, "", "utf8");

  runCommand("tmux", ["new-session", "-d", "-s", SESSION, "-n", "local", localCommand]);
  runCommand("tmux", ["new-window", "-t", SESSION, "-n", "tunnel", tunnelCommand]);
  runCommand("tmux", ["select-window", "-t", `${SESSION}:local`]);

  const state: TunnelState = {
    hostname,
    localLog,
    port,
    session: SESSION,
    tunnelLog,
    tunnelName,
  };
  writeState(state);

  console.log(`Started ${SESSION}`);
  console.log(`Public URL: https://${hostname}`);
  console.log(`Using tunnel: ${tunnelName}`);
  console.log(`Local URL: http://localhost:${port}`);
  console.log(`Token file: ${tokenFile}`);
  console.log(`Local log: ${localLog}`);
  console.log(`Tunnel log: ${tunnelLog}`);

  await sleep(400);
  await statusSession();
}

function showLogs(): void {
  const state = readState();
  if (!state) {
    throw new Error(`State file missing: ${STATE_FILE}`);
  }

  console.log(`== local (${state.localLog}) ==`);
  printFileTail(state.localLog, 60);
  console.log("");
  console.log(`== tunnel (${state.tunnelLog}) ==`);
  printFileTail(state.tunnelLog, 120);
}

async function main(): Promise<void> {
  if (ACTION === "help" || ACTION === "--help" || ACTION === "-h") {
    printHelp();
    return;
  }

  switch (ACTION) {
    case "start":
      await startSession();
      return;
    case "stop":
      stopSession();
      return;
    case "restart":
      stopSession();
      await sleep(150);
      await startSession();
      return;
    case "status":
      await statusSession();
      return;
    case "logs":
      showLogs();
      return;
    default:
      throw new Error(`Unknown action: ${ACTION} (expected: start|stop|restart|status|logs)`);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
