import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Minimal type declarations for the Node built-in `node:sqlite` module.
// `@types/node` v20 does not include these; they ship with Node >= 22.5.
// ---------------------------------------------------------------------------
interface StatementSync {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
}

interface DatabaseSync {
  prepare(sql: string): StatementSync;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (filename: string) => DatabaseSync;
}

type DatabaseConstructor = NodeSqliteModule['DatabaseSync'];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ChatMemoryEntry {
  readonly id: number;
  readonly project_name: string;
  readonly chat_title: string;
  readonly created_at?: string | number | Date | null;
}

/** Shape of a raw row returned by SELECT queries. */
interface MemoryRow {
  id: number | string;
  project_name: string;
  chat_title: string;
  created_at?: string | number | Date | null;
}

interface MemoryContentRow {
  content?: string;
}

// ---------------------------------------------------------------------------
// Module-level state (underscore prefix signals intentionally mutable)
// ---------------------------------------------------------------------------

let _db: DatabaseSync | undefined;
let _dbPath: string | undefined;
let _output: vscode.OutputChannel | undefined;
let _databaseSyncCtor: DatabaseConstructor | undefined;

const DEFAULT_DB_DIR = '.chat-memory';
const DEFAULT_DB_FILE = 'memories.db';

const SQL_FETCH_ALL =
  'SELECT id, project_name, chat_title, created_at FROM memories ORDER BY project_name ASC, created_at DESC';
const SQL_FETCH_CONTENT = 'SELECT content FROM memories WHERE id = ?';
const SQL_DELETE_ENTRY = 'DELETE FROM memories WHERE id = ?';

// ---------------------------------------------------------------------------
// Initialisation — called once from extension activate()
// ---------------------------------------------------------------------------

export function initDb(channel: vscode.OutputChannel): void {
  _output = channel;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  _output?.appendLine(`[Chat Memory] ${message}`);
}

function resolveDbPath(): string {
  const env = process.env.CHAT_MEMORY_DB_PATH?.trim();
  return env || path.join(os.homedir(), DEFAULT_DB_DIR, DEFAULT_DB_FILE);
}

function getDatabaseSyncConstructor(): DatabaseConstructor {
  if (_databaseSyncCtor) {
    return _databaseSyncCtor;
  }

  // `node:sqlite` is a Node built-in (>= 22.5) declared as a webpack external
  // so it is never bundled and always resolved from the host runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as NodeSqliteModule;
  _databaseSyncCtor = DatabaseSync;

  return _databaseSyncCtor;
}

function toChatMemoryEntry(row: MemoryRow): ChatMemoryEntry {
  return {
    id: Number(row.id),
    project_name: row.project_name,
    chat_title: row.chat_title,
    created_at: row.created_at,
  };
}

/**
 * Opens (or returns the already-open) SQLite database.
 * If the resolved path has changed since the last open the old connection is
 * closed first.
 */
function getDb(): DatabaseSync {
  const resolvedPath = resolveDbPath();

  if (_db && _dbPath === resolvedPath) {
    return _db;
  }

  // Path changed or first open — close the existing connection safely.
  closeDbConnection();

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const DatabaseSync = getDatabaseSyncConstructor();

  log(`Opening SQLite DB at ${resolvedPath}`);
  _db = new DatabaseSync(resolvedPath);
  _dbPath = resolvedPath;

  return _db;
}

/** Closes the current DB connection and clears cached state. */
function closeDbConnection(): void {
  const db = _db;
  _db = undefined;
  _dbPath = undefined;

  if (!db) {
    return;
  }

  try {
    db.close();
  } catch (err: unknown) {
    log(`Error closing SQLite DB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Force-closes the DB and clears the cached instance (e.g. on Refresh). */
export function resetPool(): void {
  closeDbConnection();
}

/** Closes the DB on extension deactivation. */
export async function closePool(): Promise<void> {
  closeDbConnection();
}

export async function fetchAllEntries(): Promise<ChatMemoryEntry[]> {
  const rows = getDb().prepare(SQL_FETCH_ALL).all() as MemoryRow[];
  return rows.map(toChatMemoryEntry);
}

export async function fetchEntryContent(id: number): Promise<string | undefined> {
  const row = getDb().prepare(SQL_FETCH_CONTENT).get(id) as MemoryContentRow | undefined;

  return row?.content;
}

export async function deleteEntry(id: number): Promise<void> {
  getDb().prepare(SQL_DELETE_ENTRY).run(id);
}
