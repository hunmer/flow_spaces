import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ARG_PREFIX = "--mini-app=";

export function miniAppLaunchId(argv) {
  const value = argv.find((arg) => arg.startsWith(ARG_PREFIX))?.slice(ARG_PREFIX.length);
  return value && value.length <= 256 && !/[\x00-\x1f]/.test(value) ? value : undefined;
}

export function miniAppLaunchUrl(origin, id) {
  return new URL(`/mini-apps-preview?id=${encodeURIComponent(id)}`, origin).href;
}

// Windows CommandLineToArgvW quoting, including quotes and trailing backslashes.
function quoteArgument(value) {
  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

function shortcutDetails({ id, name, appPath, packaged }) {
  if (typeof id !== "string" || miniAppLaunchId([`${ARG_PREFIX}${id}`]) !== id ||
      typeof name !== "string" || !name.trim()) {
    throw new Error("Invalid mini app shortcut");
  }
  const label = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().replace(/[. ]+$/g, "") || "Mini App";
  return { label, args: [...(packaged ? [] : [appPath]), `${ARG_PREFIX}${id}`] };
}

export function miniAppShortcut(input) {
  const { label, args } = shortcutDetails(input);
  return {
    filename: `Flow Spaces - ${label.slice(0, 80)}.lnk`,
    options: {
      target: input.executable,
      args: args.map(quoteArgument).join(" "),
      description: input.name.slice(0, 200),
      appUserModelId: "com.flowspaces.desktop",
    },
  };
}

function shortcutIconPng(iconBuffer) {
  const png = Buffer.from(iconBuffer);
  if (png.length < 33 || png.length > 2 * 1024 * 1024 ||
      !png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      png.toString("ascii", 12, 16) !== "IHDR" ||
      png.readUInt32BE(16) !== 256 || png.readUInt32BE(20) !== 256) {
    throw new Error("Invalid shortcut icon: expected a 256px PNG");
  }
  return png;
}

export function saveMiniAppShortcutIcon(directory, id, iconBuffer) {
  const png = shortcutIconPng(iconBuffer);
  // Windows .lnk needs an ICO file. A 256px ICO can embed PNG data directly.
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(1, 4); // one image; width/height 0 represent 256px
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bit depth
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  mkdirSync(directory, { recursive: true });
  const filename = `${createHash("sha256").update(id).digest("hex")}.ico`;
  const iconPath = path.join(directory, filename);
  writeFileSync(iconPath, Buffer.concat([header, png]));
  return iconPath;
}

export function createMacMiniAppShortcut(desktop, input, iconBuffer) {
  const { label, args } = shortcutDetails(input);
  const png = shortcutIconPng(iconBuffer);
  // 留出多字节字符、文件后缀和重名编号的空间。
  const name = `Flow Spaces - ${Array.from(label).slice(0, 55).join("")}`;
  let target = path.join(desktop, `${name}.app`);
  for (let index = 2; lstatSync(target, { throwIfNoEntry: false }); index++) {
    target = path.join(desktop, `${name} (${index}).app`);
  }

  const command = [input.executable, ...args].map((arg) => {
    const literal = arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    return `quoted form of "${literal}"`;
  }).join(' & " " & ');
  const directory = mkdtempSync(path.join(desktop, ".flow-spaces-shortcut-"));
  try {
    const bundle = path.join(directory, path.basename(target));
    const run = (file, argv) => execFileSync(file, argv, { timeout: 10000, stdio: "ignore" });
    // 直接启动 Electron 可执行文件，让参数走现有冷启动和单实例路由。
    run("/usr/bin/osacompile", ["-o", bundle, "-e", `do shell script (${command} & " </dev/null >/dev/null 2>&1 &")`]);
    const resources = path.join(bundle, "Contents", "Resources");
    const info = path.join(bundle, "Contents", "Info.plist");
    // ICNS 的 ic08 条目可以直接封装 256px PNG。
    const header = Buffer.from("icns0000ic080000", "ascii");
    header.writeUInt32BE(header.length + png.length, 4);
    header.writeUInt32BE(8 + png.length, 12);
    writeFileSync(path.join(resources, "applet.icns"), Buffer.concat([header, png]));
    rmSync(path.join(resources, "Assets.car"), { force: true });
    run("/usr/bin/plutil", ["-remove", "CFBundleIconName", info]);
    run("/usr/bin/plutil", ["-replace", "CFBundleIconFile", "-string", "applet.icns", info]);
    run("/usr/bin/plutil", ["-replace", "CFBundleIdentifier", "-string", `com.flowspaces.shortcut.${randomUUID()}`, info]);
    run("/usr/bin/codesign", ["--force", "--sign", "-", bundle]);
    renameSync(bundle, target);
    return target;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
