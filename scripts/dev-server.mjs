/** Reuse an existing backend, or wait for the backend started by this session. */
export async function ensureDevServer({ url, start, timeoutMs = 30000, intervalMs = 300 }) {
  const healthy = async () => {
    try {
      const response = await fetch(new URL('/api/health', url), { signal: AbortSignal.timeout(2000) });
      return response.ok && (await response.json()).status === 'ok';
    } catch { return false; }
  };
  if (await healthy()) return;
  const child = start();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode) throw new Error(`后端已退出: ${child.exitCode ?? child.signalCode}`);
    if (await healthy()) return;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`后端连接超时: ${url}`);
}
