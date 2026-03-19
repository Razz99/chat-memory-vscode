import * as vscode from 'vscode';
import { ChatItem, ChatMemoryProvider } from './chatMemoryProvider';
import { ChatMemoryEntry, closePool, deleteEntry, fetchEntryContent, initDb, resetPool } from './dbClient';

class MemoryContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private readonly store = new Map<string, string>();

  set(uri: vscode.Uri, content: string): void {
    this.store.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  delete(uri: vscode.Uri): void {
    this.store.delete(uri.toString());
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.store.get(uri.toString()) ?? '';
  }

  dispose(): void {
    this.store.clear();
    this._onDidChange.dispose();
  }
}

const SCHEME = 'chat-memory';

function buildUri(entry: ChatMemoryEntry): vscode.Uri {
  return vscode.Uri.parse(
    `${SCHEME}://${entry.id}/${encodeURIComponent(entry.chat_title)}.md`
  );
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Chat Memory');
  initDb(output);

  const provider = new ChatMemoryProvider(output);
  const contentProvider = new MemoryContentProvider();

  // Forward map: entry id → URI; reverse map: URI string → entry id.
  const openUris = new Map<number, vscode.Uri>();
  const uriToId = new Map<string, number>();

  /** Remove a tracked entry and clean up its virtual document. */
  function removeTrackedEntry(id: number): void {
    const uri = openUris.get(id);
    if (uri) {
      openUris.delete(id);
      uriToId.delete(uri.toString());
      contentProvider.delete(uri);
    }
  }

  context.subscriptions.push(
    output,
    provider,
    contentProvider,
    vscode.window.registerTreeDataProvider('chatMemoryView', provider),
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, contentProvider),

    vscode.commands.registerCommand('chatMemory.refresh', () => {
      resetPool();
      provider.refresh();
    }),

    vscode.commands.registerCommand('chatMemory.openEntry', async (entry: ChatMemoryEntry) => {
      try {
        const existingUri = openUris.get(entry.id);
        if (existingUri) {
          const doc = await vscode.workspace.openTextDocument(existingUri);
          await vscode.window.showTextDocument(doc, { preview: false });
          return;
        }

        const content = await fetchEntryContent(entry.id);
        if (content === undefined) {
          void vscode.window.showErrorMessage(`No content found for "${entry.chat_title}"`);
          return;
        }

        const uri = buildUri(entry);
        contentProvider.set(uri, content);
        openUris.set(entry.id, uri);
        uriToId.set(uri.toString(), entry.id);

        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to open entry "${entry.chat_title}": ${message}`);
      }
    }),

    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.uri.scheme !== SCHEME) {
        return;
      }
      const id = uriToId.get(doc.uri.toString());
      if (id !== undefined) {
        removeTrackedEntry(id);
      }
    }),

    vscode.commands.registerCommand('chatMemory.deleteEntry', async (arg: ChatMemoryEntry | ChatItem) => {
      const entry = arg instanceof ChatItem ? arg.entry : arg;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure?`,
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') {
        return;
      }

      try {
        await deleteEntry(entry.id);
        removeTrackedEntry(entry.id);
        provider.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to delete "${entry.chat_title}": ${message}`);
      }
    }),
  );
}

export async function deactivate() {
  await closePool();
}
