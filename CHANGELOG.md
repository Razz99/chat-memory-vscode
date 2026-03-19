# Change Log

All notable changes to the "chat-memory-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Migrated database layer from PostgreSQL to Node built-in SQLite (`node:sqlite`).
- DB file path now resolves from `CHAT_MEMORY_DB_PATH` or `$HOME/.chat-memory/memories.db`.