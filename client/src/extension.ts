import * as path from 'path';
import * as vscode from 'vscode';
import { DidChangeConfigurationNotification, LanguageClient, LanguageClientOptions, ProtocolNotificationType, ServerOptions, TransportKind, URI } from 'vscode-languageclient/node';
import { printDocumentTree, refreshSemanticTokens, reloadNodeTypes } from './commands';

export const EXTENSION_NAME = 'tsq-lsp-vscode';


const DEBUG = true;
let client: LanguageClient;

// let defaultClient: LanguageClient;
const clients = new Map<string, LanguageClient>();

export function activate(context: vscode.ExtensionContext) {
    // const module = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(EXTENSION_NAME);
    const extensionPath: string = context.asAbsolutePath('resources');
    const serverModule: string = context.asAbsolutePath(path.join('server', 'out', 'src', 'server.js'));
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule, //
            transport: TransportKind.ipc,
            args: [extensionPath],
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            args: [extensionPath],
        },
    };

    function didOpenTextDocument(document: vscode.TextDocument): void {
        // We are only interested in language mode text
        if (
            document.languageId !== 'tree-sitter-query'
            // ||(document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')
        ) {
            return;
        }

        const uri = document.uri;
        let folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder) {
            console.debug(`bailed on folder-less document "${document.uri}" `);
            return;
        }
        folder = getOuterMostWorkspaceFolder(folder);

        if (!clients.has(folder.uri.toString())) {
            // console.debug(`Starting new client for workspace "${folder.name}"`);
            const clientOptions: LanguageClientOptions = {
                documentSelector: [{ pattern: '**/queries/**/*.scm' }],
                diagnosticCollectionName: EXTENSION_NAME,
                workspaceFolder: folder,
                outputChannel: outputChannel,
            };
            const client = new LanguageClient(EXTENSION_NAME, serverOptions, clientOptions);
            client.start();
            clients.set(folder.uri.toString(), client);
            console.debug(`Client started for workspace "${folder.name}"`);
            console.debug(`Current client count: ${clients.size}`);
        }
    }

    function didChangeConfiguration(event: vscode.ConfigurationChangeEvent) {
        [...clients.entries()]
            .filter(([uri, _client]) => {
                try {
                    const uri_ = vscode.Uri.parse(uri);
                    return event.affectsConfiguration(EXTENSION_NAME, uri_);
                } catch (error) {
                    console.error(error);
                }
                return true; // just assume I guess?
            })
            .forEach(([_uri, client]) => client.sendNotification(DidChangeConfigurationNotification.type, {settings: undefined}));

    }

    vscode.workspace.onDidOpenTextDocument(didOpenTextDocument);
    vscode.workspace.textDocuments.forEach(didOpenTextDocument);

    vscode.workspace.onDidChangeWorkspaceFolders(event => {
        for (const folder of event.removed) {
            const client = clients.get(folder.uri.toString());
            if (client) {
                clients.delete(folder.uri.toString());
                client.stop();
                console.debug(`Stopping client for "${folder.name}"`);
                console.debug(`Current client count: ${clients.size}`);
            }
        }
    });

    vscode.workspace.onDidChangeConfiguration(didChangeConfiguration);

    // async function reloadNodeTypes() {
    //     const uri: vscode.Uri = vscode.window.activeTextEditor.document.uri;
    //     let client = [...clients.entries()]
    //         .filter(([workspace, _]) => uri.toString().startsWith(workspace))
    //         .map(([_, client]) => client)
    //         .at(0);
    //     if (!client) {
    //         console.error(`failed to execute command for URI "${uri}"`);
    //         return;
    //     }
    //     client.sendRequest(
    //         ExecuteCommandRequest.type, //
    //         {
    //             command: 'vscode-tree-sitter-dev.reloadNodeTypes',
    //             arguments: [uri],
    //         }
    //     );
    // }

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-tree-sitter-dev.reload-node-types', () => reloadNodeTypes(clients)),
        vscode.commands.registerCommand('vscode-tree-sitter-dev.print-document-tree', () => printDocumentTree(clients)),
        vscode.commands.registerCommand('vscode-tree-sitter-dev.refresh-semantic-tokens', () => refreshSemanticTokens(clients))
    );
}

export function deactivate(): Thenable<void> {
    const promises: Thenable<void>[] = [];
    // if (defaultClient) {
    //     promises.push(defaultClient.stop());
    // }
    console.debug(`Deactivating ${clients.size} clients`);
    for (const client of clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}

let _sortedWorkspaceFolders: string[] | undefined;
function sortedWorkspaceFolders(): string[] {
    if (_sortedWorkspaceFolders === void 0) {
        _sortedWorkspaceFolders = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders
                  .map(folder => {
                      let result = folder.uri.toString();
                      if (result.charAt(result.length - 1) !== '/') {
                          result = result + '/';
                      }
                      return result;
                  })
                  .sort((a, b) => {
                      return a.length - b.length;
                  })
            : [];
    }
    return _sortedWorkspaceFolders;
}
vscode.workspace.onDidChangeWorkspaceFolders(() => (_sortedWorkspaceFolders = undefined));

function getOuterMostWorkspaceFolder(folder: vscode.WorkspaceFolder): vscode.WorkspaceFolder {
    const sorted = sortedWorkspaceFolders();
    for (const element of sorted) {
        let uri = folder.uri.toString();
        if (uri.charAt(uri.length - 1) !== '/') {
            uri = uri + '/';
        }
        if (uri.startsWith(element)) {
            return vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(element))!;
        }
    }
    return folder;
}
