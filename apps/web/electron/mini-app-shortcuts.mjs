import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
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

export function miniAppShortcut({ id, name, executable, appPath, packaged }) {
  if (typeof id !== "string" || miniAppLaunchId([`${ARG_PREFIX}${id}`]) !== id ||
      typeof name !== "string" || !name.trim()) {
    throw new Error("Invalid mini app shortcut");
  }
  const label = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().replace(/[. ]+$/g, "").slice(0, 80) || "Mini App";
  return {
    filename: `Flow Spaces - ${label}.lnk`,
    options: {
      target: executable,
      args: [...(packaged ? [] : [appPath]), `${ARG_PREFIX}${id}`].map(quoteArgument).join(" "),
      description: name.slice(0, 200),
      appUserModelId: "com.flowspaces.desktop",
    },
  };
}

export function saveMiniAppShortcutIcon(directory, id, iconBuffer) {
  const png = Buffer.from(iconBuffer);
  if (png.length < 33 || png.length > 2 * 1024 * 1024 ||
      !png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      png.toString("ascii", 12, 16) !== "IHDR" ||
      png.readUInt32BE(16) !== 256 || png.readUInt32BE(20) !== 256) {
    throw new Error("Invalid shortcut icon: expected a 256px PNG");
  }
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
