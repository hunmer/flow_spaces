"use client";

import Image from "next/image";

// 图标集已精简（apps/web/public/icons/ 共 20 种）。
// 未列出的扩展名 / 文件名 / 文件夹名统一回退到 default_file / default_folder。

const extMap: Record<string, string> = {
  ".ts": "file_type_typescript",
  ".tsx": "file_type_reactts",
  ".js": "file_type_js",
  ".jsx": "file_type_js",
  ".mjs": "file_type_js",
  ".cjs": "file_type_js",
  ".json": "file_type_json",
  ".json5": "file_type_json",
  ".jsonc": "file_type_json",
  ".md": "file_type_markdown",
  ".mdx": "file_type_markdown",
  ".css": "file_type_css",
  ".scss": "file_type_css",
  ".less": "file_type_css",
  ".html": "file_type_html",
  ".htm": "file_type_html",
  ".svg": "file_type_svg",
  ".png": "file_type_image",
  ".jpg": "file_type_image",
  ".jpeg": "file_type_image",
  ".gif": "file_type_image",
  ".webp": "file_type_image",
  ".ico": "file_type_image",
  ".yaml": "file_type_yaml",
  ".yml": "file_type_yaml",
  ".toml": "file_type_config",
  ".xml": "file_type_config",
  ".sql": "file_type_sql",
  ".sh": "file_type_shell",
  ".bash": "file_type_shell",
  ".zsh": "file_type_shell",
  ".py": "file_type_python",
  ".txt": "file_type_text",
  ".log": "file_type_text",
  ".env": "file_type_config",
};

const nameMap: Record<string, string> = {
  "tsconfig.json": "file_type_typescript",
  "jsconfig.json": "file_type_js",
  "dockerfile": "file_type_docker",
  "docker-compose.yml": "file_type_docker",
  "docker-compose.yaml": "file_type_docker",
  ".dockerignore": "file_type_docker",
  "makefile": "file_type_config",
  ".gitignore": "file_type_git",
  ".gitattributes": "file_type_git",
  ".editorconfig": "file_type_config",
  ".eslintrc": "file_type_config",
  ".eslintrc.js": "file_type_config",
  ".eslintrc.json": "file_type_config",
  ".eslintrc.cjs": "file_type_config",
  ".prettierrc": "file_type_config",
  ".prettierrc.js": "file_type_config",
  ".prettierrc.json": "file_type_config",
  ".env.local": "file_type_config",
  ".env.development": "file_type_config",
  ".env.production": "file_type_config",
  ".env.test": "file_type_config",
};

function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
}

export function getFileIconPath(name: string): string {
  const lower = name.toLowerCase();
  if (nameMap[lower]) return `/icons/${nameMap[lower]}.svg`;

  const ext = getExtension(name);
  if (ext && extMap[ext]) return `/icons/${extMap[ext]}.svg`;

  return "/icons/default_file.svg";
}

export function getFolderIconPath(name: string, isOpen: boolean): string {
  // 图标集已精简：文件夹统一使用默认图标，不再区分 folder_type_*。
  return isOpen ? "/icons/default_folder_opened.svg" : "/icons/default_folder.svg";
}

export function FileIconImg({ name }: { name: string }) {
  return (
    <Image
      src={getFileIconPath(name)}
      alt={name}
      width={16}
      height={16}
      className="size-4 shrink-0"
      unoptimized
    />
  );
}

export function FolderIconImg({ name, isOpen }: { name: string; isOpen: boolean }) {
  return (
    <Image
      src={getFolderIconPath(name, isOpen)}
      alt={name}
      width={16}
      height={16}
      className="size-4 shrink-0"
      unoptimized
    />
  );
}
