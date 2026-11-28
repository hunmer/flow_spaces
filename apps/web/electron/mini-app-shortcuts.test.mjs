import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import path from "node:path";
import vm from "node:vm";
import { miniAppLaunchId, miniAppLaunchUrl, miniAppShortcut, saveMiniAppShortcutIcon } from "./mini-app-shortcuts.mjs";

const input = {
  id: "app-1",
  name: "本地应用",
  executable: "C:\\Program Files\\Flow Spaces\\Flow Spaces.exe",
  appPath: "E:\\my project\\electron\\main.mjs",
  packaged: true,
};

test("packaged shortcut launches the executable with an app ID, without a fixed server port", () => {
  const { options } = miniAppShortcut(input);
  assert.equal(options.target, input.executable);
  assert.equal(options.args, '"--mini-app=app-1"');
  assert.equal(miniAppLaunchId([input.executable, "--mini-app=app-1"]), input.id);
  assert.equal(miniAppLaunchUrl("http://127.0.0.1:43210", input.id), "http://127.0.0.1:43210/mini-apps-preview?id=app-1");
});

test("development shortcut quotes the entry file and Windows argument special characters", () => {
  const { options } = miniAppShortcut({ ...input, packaged: false, id: 'app "quoted"\\' });
  assert.equal(options.args, '"E:\\my project\\electron\\main.mjs" "--mini-app=app \\"quoted\\"\\\\"');
});

test("shortcut names are safe, bounded, and contain no ID suffix", () => {
  const a = miniAppShortcut({ ...input, name: '../CON<>:"/\\|?*\n. ' });
  assert.doesNotMatch(a.filename, /[<>:"/\\|?*\x00-\x1f]/);
  assert.match(a.filename, /^Flow Spaces - .*\.lnk$/);
  assert.equal(miniAppShortcut(input).filename, miniAppShortcut(input).filename);
  assert.equal(miniAppShortcut(input).filename, "Flow Spaces - 本地应用.lnk");
  assert.equal(miniAppShortcut(input).filename, miniAppShortcut({ ...input, id: "app-2" }).filename);
  assert.ok(miniAppShortcut({ ...input, name: "a".repeat(1000) }).filename.length < 120);
});

test("invalid launch IDs and shortcut payloads are rejected", () => {
  for (const id of ["", "a\n", "a".repeat(257)]) {
    assert.equal(miniAppLaunchId([`--mini-app=${id}`]), undefined);
    assert.throws(() => miniAppShortcut({ ...input, id }));
  }
  assert.equal(miniAppLaunchId(["electron", "--other"]), undefined);
  assert.throws(() => miniAppShortcut({ ...input, name: " " }));
  assert.throws(() => miniAppShortcut({ ...input, id: undefined }));
});

test("preview routing encodes IDs rather than injecting URL query or hash", () => {
  const id = "应用 &?#/";
  const url = new URL(miniAppLaunchUrl("http://127.0.0.1:5000", id));
  assert.equal(url.pathname, "/mini-apps-preview");
  assert.equal(url.searchParams.get("id"), id);
  assert.equal(url.hash, "");
});

test("Electron cold start, second instance, and shortcut IPC route to the requested app", async () => {
  const windows = [];
  const handlers = new Map();
  const shortcuts = [];
  const app = Object.assign(new EventEmitter(), {
    isPackaged: false,
    setName() {}, setAppUserModelId() {},
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    getPath: () => "C:\\Desktop",
  });
  class FakeWindow extends EventEmitter {
    constructor() {
      super();
      windows.push(this);
      this.webContents = Object.assign(new EventEmitter(), {
        setWindowOpenHandler() {}, getURL: () => this.url,
      });
    }
    async loadURL(url) { this.url = url; }
    isMinimized() { return true; }
    restore() { this.restored = true; }
    focus() { this.focused = true; }
    static getAllWindows() { return windows; }
  }
  // Exercise main-process lifecycle with native Electron surfaces replaced by fakes.
  const source = readFileSync(new URL("./main.mjs", import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "")
    .replace(/^const __dirname = .*;\r?$/m, 'const __dirname = "E:/flow spaces/electron";');
  vm.runInNewContext(source, {
    app, BrowserWindow: FakeWindow, path, URL, console,
    miniAppLaunchId, miniAppLaunchUrl, miniAppShortcut,
    saveMiniAppShortcutIcon: () => "C:/icons/app.ico",
    process: { env: {}, platform: "win32", execPath: input.executable, argv: ["electron", "--mini-app=cold"] },
    fetch: async () => ({ ok: true }),
    ipcMain: { on() {}, handle: (name, handler) => handlers.set(name, handler) },
    shell: { writeShortcutLink: (...args) => { shortcuts.push(args); return true; } },
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  assert.equal(windows.length, 1);
  assert.equal(new URL(windows[0].url).searchParams.get("id"), "cold");
  app.emit("second-instance", {}, ["electron", "--mini-app=warm"]);
  await settle();
  assert.equal(windows.length, 2);
  assert.equal(new URL(windows[1].url).searchParams.get("id"), "warm");
  app.emit("second-instance", {}, ["electron", "--mini-app=warm"]);
  await settle();
  assert.equal(windows.length, 2);
  assert.ok(windows[1].focused && windows[1].restored);
  const create = handlers.get("miniApps:createDesktopShortcut");
  create({ sender: windows[0].webContents }, { id: "cold", name: "应用" });
  assert.equal(shortcuts.length, 1);
  assert.match(shortcuts[0][0], /\.lnk$/);
  assert.match(shortcuts[0][2].args, /--mini-app=cold/);
  assert.equal(shortcuts[0][2].icon, "C:/icons/app.ico");
  assert.throws(() => create({ sender: { getURL: () => "https://example.com" } }, input));
});


test("persists a Windows ICO with a 256px PNG payload and rejects invalid data", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "mini-app-icons-"));
  try {
    const png = Buffer.alloc(33);
    Buffer.from("89504e470d0a1a0a", "hex").copy(png);
    png.write("IHDR", 12);
    png.writeUInt32BE(256, 16);
    png.writeUInt32BE(256, 20);
    const filename = saveMiniAppShortcutIcon(directory, "../app", png);
    assert.equal(path.dirname(filename), directory);
    const ico = readFileSync(filename);
    assert.equal(ico.readUInt16LE(2), 1);
    assert.equal(ico.readUInt16LE(4), 1);
    assert.equal(ico.readUInt32LE(14), png.length);
    assert.equal(ico.readUInt32LE(18), 22);
    assert.deepEqual(ico.subarray(22), png);
    assert.equal(saveMiniAppShortcutIcon(directory, "../app", png), filename);
    assert.throws(() => saveMiniAppShortcutIcon(directory, "app", Buffer.from("invalid")));
    png.writeUInt32BE(512, 16);
    assert.throws(() => saveMiniAppShortcutIcon(directory, "app", png));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
