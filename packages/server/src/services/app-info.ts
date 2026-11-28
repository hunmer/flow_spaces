import { execFile, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { gt, valid } from 'semver';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const exec = promisify(execFile);

export function getAppInfo() {
  return { name: 'Flow Spaces', version: manifest.version as string, platform: process.platform, runtime: 'npm' as const, packageName: manifest.name as string };
}

type RunCommand = (command: string, args: string[], options: ExecFileOptionsWithStringEncoding) => Promise<{ stdout: string | Buffer }>;

export async function checkNpmUpdate(run: RunCommand = exec) {
  // Windows 的 npm 是 cmd shim；参数全部固定，不接受请求输入。
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm view ${manifest.name}@latest version --json`]
    : ['view', `${manifest.name}@latest`, 'version', '--json'];
  const { stdout } = await run(command, args, { timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'utf8' });
  const latestVersion: unknown = JSON.parse(String(stdout));
  if (typeof latestVersion !== 'string' || !valid(latestVersion) || !valid(manifest.version)) {
    throw new Error('Invalid npm package version');
  }
  return { ...getAppInfo(), latestVersion, updateAvailable: gt(latestVersion, manifest.version) };
}
