import * as vscode from 'vscode';
import { Pool, PoolConfig } from 'pg';

export interface ChatMemoryEntry {
  readonly id: number;
  readonly project_name: string;
  readonly chat_title: string;
  readonly created_at?: Date;
}

let pool: Pool | undefined;
let output: vscode.OutputChannel | undefined;

export function initDb(channel: vscode.OutputChannel): void {
  output = channel;
}

function getDbConfig(): PoolConfig {
  const config = vscode.workspace.getConfiguration('chatMemory');
  const ssl = config.get<boolean>('ssl', false);
  return {
    host: config.get<string>('host', 'localhost'),
    port: config.get<number>('port', 3245),
    database: config.get<string>('database', 'chat_memory'),
    user: config.get<string>('user', 'user'),
    password: config.get<string>('password', 'password'),
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
    max: 5,
  };
}

function getPool(): Pool {
  if (!pool) {
    const cfg = getDbConfig();
    output?.appendLine(
      `[Chat Memory] Connecting to ${cfg.host}:${cfg.port} db=${cfg.database} user=${cfg.user} ssl=${!!cfg.ssl}`
    );
    pool = new Pool(cfg);
    pool.on('error', (err) => {
      output?.appendLine(`[Chat Memory] Pool error: ${err.message}`);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  const p = pool;
  pool = undefined;
  if (p) {
    try {
      await p.end();
    } catch (err: unknown) {
      output?.appendLine(
        `[Chat Memory] Error closing pool: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

export function resetPool(): void {
  const p = pool;
  pool = undefined;
  p?.end().catch((err: unknown) => {
    output?.appendLine(
      `[Chat Memory] Error closing old pool: ${err instanceof Error ? err.message : String(err)}`
    );
  });
}

const FETCH_ALL_SQL =
  'SELECT id, project_name, chat_title, created_at FROM memories ORDER BY project_name ASC, created_at DESC';

export async function fetchAllEntries(): Promise<ChatMemoryEntry[]> {
  const { rows } = await getPool().query<ChatMemoryEntry>(FETCH_ALL_SQL);
  return rows;
}

export async function fetchEntryContent(id: number): Promise<string | undefined> {
  const { rows } = await getPool().query<{ content: string }>(
    'SELECT content FROM memories WHERE id = $1',
    [id]
  );
  return rows[0]?.content;
}

export async function deleteEntry(id: number): Promise<void> {
  await getPool().query('DELETE FROM memories WHERE id = $1', [id]);
}
