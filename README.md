# Chat Memory

A VS Code extension to browse and manage memorised Copilot chat sessions stored in a PostgreSQL database.

## Features

- **Sidebar tree view** — Browse saved chat memories grouped by project name.
- **Open entries** — View chat memory content as Markdown in a read-only editor tab.
- **Delete entries** — Remove memories directly from the tree view context menu.
- **Auto-refresh** — Automatically refreshes when database connection settings change.

## Requirements

- A running **PostgreSQL** database with a `memories` table containing columns: `id`, `project_name`, `chat_title`, `content`, `created_at`.

## Extension Settings

This extension contributes the following settings under `chatMemory.*`:

| Setting | Type | Default | Description |
|---|---|---|---|
| `chatMemory.host` | string | `localhost` | PostgreSQL host |
| `chatMemory.port` | number | `3245` | PostgreSQL port |
| `chatMemory.database` | string | `chat_memory` | PostgreSQL database name |
| `chatMemory.user` | string | `user` | PostgreSQL user |
| `chatMemory.password` | string | `password` | PostgreSQL password |
| `chatMemory.ssl` | boolean | `false` | Enable SSL (required for hosted databases like Neon, Supabase) |

## Usage

1. Open the **Chat Memory** panel from the activity bar.
2. The tree view displays memories grouped by project.
3. Click an entry to view its content.
4. Use the trash icon to delete an entry.
5. Use the refresh button to reload from the database.

## Release Notes

### 0.0.1

Initial release.
