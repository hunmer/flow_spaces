import { createHash } from "node:crypto";

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
  const suffix = createHash("sha256").update(id).digest("hex").slice(0, 12);
  return {
    filename: `Flow Spaces - ${label} - ${suffix}.lnk`,
    options: {
      target: executable,
      args: [...(packaged ? [] : [appPath]), `${ARG_PREFIX}${id}`].map(quoteArgument).join(" "),
      description: name.slice(0, 200),
      appUserModelId: "com.flowspaces.desktop",
    },
  };
}
