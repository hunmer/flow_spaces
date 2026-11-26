import { simpleGit } from 'simple-git';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// 瘦身后仅保留 workspace 从 git 导入所需的 gitClone（报告 6.3）。
// 其余导出（gitStatus/gitCommit/gitPush/git-config 等消费者已随 routes/git.ts
// 与 notification-hub 机器人体系删除）已于 2026-11-10 清理。

function getGitOptions(): Partial<import('simple-git').SimpleGitOptions> {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy;
  const config: string[] = [];
  if (proxy) {
    config.push(`http.proxy=${proxy}`, `https.proxy=${proxy}`);
  }
  return config.length ? { config } : {};
}

export interface GitCloneProgress {
  phase: 'counting' | 'compressing' | 'receiving' | 'resolving' | 'done' | 'error';
  progress: number;
  received?: number;
  total?: number;
  error?: string;
}

export async function gitClone(
  targetDir: string,
  url: string,
  onProgress: (progress: GitCloneProgress) => void,
): Promise<string> {
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  const repoName = basename(url, '.git').replace(/\.git$/, '') || 'repo';
  const cloneDir = join(targetDir, repoName);

  if (existsSync(cloneDir)) {
    throw new Error(`目录 ${cloneDir} 已存在`);
  }

  const git = simpleGit(getGitOptions());
  git.outputHandler((_binary, _stdout, stderr) => {
    stderr.on('data', (chunk: Buffer) => {
      const parsed = parseCloneProgress(chunk.toString());
      if (parsed) onProgress(parsed);
    });
  });

  await git.clone(url, cloneDir, ['--progress']);
  return cloneDir;
}

function parseCloneProgress(text: string): GitCloneProgress | null {
  // git --progress 输出用 \r 覆盖，可能有多个阶段在同一段文本中
  const lines = text.split('\r').filter(Boolean);
  let result: GitCloneProgress | null = null;

  for (const line of lines) {
    const m =
      line.match(/Counting objects:\s*(\d+)%\s*\((\d+)\/(\d+)\)/) ||
      line.match(/Compressing objects:\s*(\d+)%\s*\((\d+)\/(\d+)\)/) ||
      line.match(/Receiving objects:\s*(\d+)%\s*\((\d+)\/(\d+)\)/) ||
      line.match(/Resolving deltas:\s*(\d+)%\s*\((\d+)\/(\d+)\)/);

    if (m) {
      const phaseMap: Record<string, GitCloneProgress['phase']> = {
        Counting: 'counting',
        Compressing: 'compressing',
        Receiving: 'receiving',
        Resolving: 'resolving',
      };
      const keyword = m[0].split(' ')[0];
      result = {
        phase: phaseMap[keyword] || 'receiving',
        progress: parseInt(m[1]),
        received: parseInt(m[2]),
        total: parseInt(m[3]),
      };
    }
  }

  return result;
}
