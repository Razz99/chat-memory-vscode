# Chat Memory

A VS Code extension to browse and manage memorised Copilot chat sessions stored in a SQLite database.

## Features

- **Sidebar tree view** — Browse saved chat memories grouped by project name.
- **Open entries** — View chat memory content as Markdown in a read-only editor tab.
- **Delete entries** — Remove memories directly from the tree view context menu.
- **Refresh** — Reload memories from disk.

## Requirements

| Requirement | Detail |
|---|---|
| VS Code | ≥ 1.109.0 |
| Node.js | ≥ 22.5.0 (ships the `node:sqlite` built-in) |
| SQLite DB | A file with a `memories` table (see schema below) |

### Expected table schema

```sql
CREATE TABLE memories (
  id           INTEGER PRIMARY KEY,
  project_name TEXT    NOT NULL,
  chat_title   TEXT    NOT NULL,
  content      TEXT,
  created_at   TEXT    -- ISO-8601 timestamp recommended
);
```

### Database path resolution

The extension looks for the SQLite file in this order:

1. `CHAT_MEMORY_DB_PATH` environment variable (if set and non-empty)
2. Fallback: `$HOME/.chat-memory/memories.db`

The parent directory is created automatically if it does not exist.

## Usage

1. Open the **Chat Memory** panel from the activity bar.
2. The tree view displays memories grouped by project.
3. Click an entry to view its Markdown content in a read-only tab.
4. Use the **trash** icon (hover over an entry) to delete it.
5. Use the **refresh** button at the top of the panel to reload from disk.

## Release Notes

### 0.0.1

Initial release — SQLite-backed chat memory browser.
