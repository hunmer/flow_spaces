// SQLite 连接与执行层（better-sqlite3）。
// 本文件分两阶段落地：Task 2 只含纯函数校验；Task 3 追加连接管理与执行。
import Database from 'better-sqlite3';
import { join, resolve, sep, dirname } from 'node:path';
import { ensureDir } from './json-store.js';
import { getProjectDir } from './mini-app-store.js';
import { MAX_ROWS, type SqlParams } from './sql-safety.js';
// 重新导出纯校验函数，保持 mini-app-db 既有公开 API（validateDbName/checkSql/bindArgs）
// 不破坏下游 import；真相源在 sql-safety。
export { validateDbName, checkSql, bindArgs } from './sql-safety.js';
import { validateDbName, checkSql, bindArgs } from './sql-safety.js';

type DbConnection = InstanceType<typeof Database>;
type ExecMode = 'all' | 'get' | 'run' | 'exec';

// 连接池：按 `projectId/dbName` 复用，避免每次请求重开文件。
const POOL = new Map<string, DbConnection>();

// 使用项目实际目录，让本地关联应用继续使用其原有数据库。
function dbFilePath(projectId: string, dbName: string): string {
  const root = resolve(join(getProjectDir(projectId), 'data', 'db'));
  const target = resolve(root, `${dbName}.sqlite`);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path escapes project db directory: ${dbName}`);
  }
  return target;
}

export function openDb(projectId: string, dbName: string): DbConnection {
  validateDbName(dbName);
  const key = `${projectId}/${dbName}`;
  const cached = POOL.get(key);
  if (cached) return cached;
  const fullPath = dbFilePath(projectId, dbName);
  ensureDir(dirname(fullPath));
  const db = new Database(fullPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  POOL.set(key, db);
  return db;
}

export function executeDb(
  projectId: string,
  dbName: string,
  mode: ExecMode,
  sql: string,
  params?: SqlParams,
): unknown {
  checkSql(sql);
  const db = openDb(projectId, dbName);
  if (mode === 'exec') {
    db.exec(sql);
    return undefined;
  }
  const stmt = db.prepare(sql);
  const args = bindArgs(params);
  if (mode === 'all') {
    const rows = stmt.all(...args);
    if (rows.length > MAX_ROWS) throw new Error(`Result exceeds ${MAX_ROWS} rows`);
    return rows;
  }
  if (mode === 'get') {
    return stmt.get(...args) ?? null;
  }
  const r = stmt.run(...args);
  return { changes: r.changes, lastInsertRowid: r.lastInsertRowid as number | bigint };
}

export function executeDbTransaction(
  projectId: string,
  dbName: string,
  statements: { sql: string; params?: SqlParams }[],
): void {
  for (const s of statements) checkSql(s.sql);
  const db = openDb(projectId, dbName);
  const runTx = db.transaction(() => {
    for (const { sql, params } of statements) {
      db.prepare(sql).run(...bindArgs(params));
    }
  });
  runTx(); // 抛错则 better-sqlite3 自动回滚整个事务
}

export function closeProjectDbs(projectId: string): void {
  const prefix = `${projectId}/`;
  for (const [key, db] of POOL) {
    if (key.startsWith(prefix)) {
      try { db.close(); } catch { /* noop */ }
      POOL.delete(key);
    }
  }
}
