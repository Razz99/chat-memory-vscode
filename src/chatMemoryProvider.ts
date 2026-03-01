import * as vscode from 'vscode';
import { ChatMemoryEntry, fetchAllEntries } from './dbClient';

export type MemoryTreeItem = ProjectItem | ChatItem;

export class ProjectItem extends vscode.TreeItem {
  readonly contextValue = 'projectItem' as const;

  constructor(public readonly projectName: string) {
    super(projectName, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export class ChatItem extends vscode.TreeItem {
  readonly contextValue = 'chatItem' as const;

  constructor(public readonly entry: ChatMemoryEntry) {
    super(`${entry.id}: ${entry.chat_title}`, vscode.TreeItemCollapsibleState.None);
    this.description = entry.created_at
      ? new Date(entry.created_at).toLocaleDateString()
      : '';
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
    this.command = {
      command: 'chatMemory.openEntry',
      title: 'Open Entry',
      arguments: [entry],
    };
  }
}

export class ChatMemoryProvider
  implements vscode.TreeDataProvider<MemoryTreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<MemoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private grouped: Map<string, ChatMemoryEntry[]> | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  refresh(): void {
    this.grouped = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MemoryTreeItem): Promise<MemoryTreeItem[]> {
    try {
      if (!element) {
        if (!this.grouped) {
          this.grouped = groupByProject(await fetchAllEntries());
        }
        return [...this.grouped.keys()].map((p) => new ProjectItem(p));
      }
      if (element instanceof ProjectItem) {
        return (this.grouped?.get(element.projectName) ?? []).map((e) => new ChatItem(e));
      }
      return [];
    } catch (err: unknown) {
      this.handleLoadError(err);
      return [];
    }
  }

  private handleLoadError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? message) : message;
    this.output.appendLine(`[Chat Memory] Error loading entries:\n${stack}`);
    this.output.show(true);
    vscode.window
      .showErrorMessage(`Failed to load chat memories: ${message}`, 'Show Output')
      .then((action) => {
        if (action === 'Show Output') {
          this.output.show();
        }
      });
  }
}

function groupByProject(
  entries: ChatMemoryEntry[]
): Map<string, ChatMemoryEntry[]> {
  const map = new Map<string, ChatMemoryEntry[]>();
  for (const entry of entries) {
    let list = map.get(entry.project_name);
    if (!list) {
      list = [];
      map.set(entry.project_name, list);
    }
    list.push(entry);
  }
  return map;
}
