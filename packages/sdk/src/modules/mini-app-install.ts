import type { MiniAppProject } from './mini-apps';

/** 以文件数计量，已校验一致的文件也计入 completed。 */
export interface MiniAppInstallProgress {
  total: number;
  completed: number;
  downloaded: number;
  skipped: number;
  path?: string;
  installDevelopment: boolean;
}

export interface MiniAppInstallResult {
  project: MiniAppProject;
  downloaded: number;
  skipped: number;
}

export async function readMiniAppInstallStream(
  response: Response,
  onProgress: (progress: MiniAppInstallProgress) => void,
): Promise<MiniAppInstallResult> {
  if (!response.ok) throw new Error(`Install failed (${response.status}): ${await response.text()}`);
  if (!response.body) throw new Error('Install response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const message = JSON.parse(line.slice(6));
        if (message.type === 'progress') onProgress(message.data);
        else if (message.type === 'result') return message.data;
        else if (message.type === 'error') throw new Error(message.data.error);
      }
      if (done) throw new Error('Install progress stream ended before completion');
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
