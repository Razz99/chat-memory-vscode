import * as vscode from 'vscode';
import { ChatItem, ChatMemoryProvider } from './chatMemoryProvider';
import { ChatMemoryEntry, closePool, deleteEntry, fetchEntryContent, initDb, resetPool } from './dbClient';

class MemoryContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private readonly store = new Map<string, string>();

  set(uri: vscode.Uri, content: string): void {
    this.store.set(uri.toString(), content);
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
  const openUris = new Map<number, vscode.Uri>();

  /** Remove a tracked entry and clean up its virtual document. */
  function removeTrackedEntry(id: number): void {
    const uri = openUris.get(id);
    if (uri) {
      openUris.delete(id);
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
      const existingUri = openUris.get(entry.id);
      if (existingUri) {
        const doc = await vscode.workspace.openTextDocument(existingUri);
        await vscode.window.showTextDocument(doc, { preview: false });
        return;
      }

      const content = await fetchEntryContent(entry.id);
      if (content === undefined) {
        vscode.window.showErrorMessage(`No content found for "${entry.chat_title}"`);
        return;
      }

      const uri = buildUri(entry);
      contentProvider.set(uri, content);
      openUris.set(entry.id, uri);

      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    }),

    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.uri.scheme !== SCHEME) {
        return;
      }
      const docStr = doc.uri.toString();
      for (const [id, uri] of openUris) {
        if (uri.toString() === docStr) {
          removeTrackedEntry(id);
          break;
        }
      }
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('chatMemory')) {
        resetPool();
        provider.refresh();
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

      await deleteEntry(entry.id);
      removeTrackedEntry(entry.id);
      provider.refresh();
    }),
  );
}

export async function deactivate() {
  await closePool();
}
