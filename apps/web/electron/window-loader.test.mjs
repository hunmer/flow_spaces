import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { attachWindowLoader } from "./window-loader.mjs";

const settle = () => new Promise((resolve) => setImmediate(resolve));

function setup() {
  const views = [];
  const children = new Set();
  class View {
    constructor(options) {
      this.options = options;
      views.push(this);
      this.webContents = {
        isDestroyed: () => !!this.closed,
        close: () => { this.closed = true; },
        loadFile: async (file) => { this.file = file; },
        executeJavaScript: (script) => {
          this.script = script;
          return new Promise((resolve) => { this.finishFade = resolve; });
        },
      };
    }
    setBackgroundColor(color) { this.background = color; }
    setBounds(bounds) { this.bounds = bounds; }
  }
  const win = Object.assign(new EventEmitter(), {
    webContents: new EventEmitter(),
    contentView: {
      addChildView: (view) => children.add(view),
      removeChildView: (view) => { assert.ok(children.delete(view)); },
    },
    isDestroyed: () => !!win.destroyed,
    getContentSize: () => win.size,
    size: [900, 600],
  });
  attachWindowLoader(win, View);
  return { win, views, children };
}

test("loader covers startup, resizes, and stays attached until fade finishes", async () => {
  const { win, views, children } = setup();
  const view = views[0];
  assert.equal(children.size, 1);
  assert.equal(view.options.webPreferences.sandbox, true);
  win.webContents.emit("did-start-navigation", {}, "http://app", false, true);
  assert.equal(views.length, 1);
  assert.equal(view.background, "#00000000");
  assert.match(view.file, /window-loader\.html$/);
  assert.deepEqual(view.bounds, { x: 0, y: 0, width: 900, height: 600 });
  win.size = [1200, 800];
  win.emit("resize");
  assert.equal(view.bounds.width, 1200);
  win.webContents.emit("did-finish-load");
  await settle();
  assert.match(view.script, /opacity: 0/);
  assert.equal(children.size, 1);
  view.finishFade();
  await settle();
  assert.equal(children.size, 0);
  assert.ok(view.closed);
});

test("new navigation cannot be dismissed by the previous navigation's fade", async () => {
  const { win, views, children } = setup();
  win.webContents.emit("did-finish-load");
  await settle();
  win.webContents.emit("did-start-navigation", {}, "http://app/next", false, true);
  assert.ok(views[0].closed);
  views[0].finishFade();
  await settle();
  assert.ok(children.has(views[1]));
  win.webContents.emit("did-start-navigation", {}, "http://app/next#hash", true, true);
  win.webContents.emit("did-start-navigation", {}, "http://app/frame", false, false);
  assert.equal(views.length, 2);
  win.emit("closed");
});

test("aborted/subframe loads preserve loader; main frame failure fades it", async () => {
  const { win, views } = setup();
  win.webContents.emit("did-fail-load", {}, -3, "aborted", "http://app", true);
  win.webContents.emit("did-fail-load", {}, -105, "failed", "http://frame", false);
  await settle();
  assert.equal(views[0].script, undefined);
  win.webContents.emit("did-fail-load", {}, -105, "failed", "http://app", true);
  await settle();
  assert.ok(views[0].finishFade);
  views[0].finishFade();
  await settle();
  assert.ok(views[0].closed);
});

test("closing during a fade disposes native contents and removes listeners", async () => {
  const { win, views } = setup();
  win.webContents.emit("did-finish-load");
  await settle();
  const contents = win.webContents;
  win.destroyed = true;
  win.webContents = undefined; // Electron 在 closed 事件中已不再提供此属性。
  win.emit("closed");
  assert.ok(views[0].closed);
  assert.equal(contents.listenerCount("did-start-navigation"), 0);
  assert.equal(win.listenerCount("resize"), 0);
  views[0].finishFade();
  await settle();
});
