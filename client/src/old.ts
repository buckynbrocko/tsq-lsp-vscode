import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { printDocumentTree } from './commands';

const DEBUG = true;
let client: LanguageClient;

export function old_activate(context: vscode.ExtensionContext) {
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

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ pattern: '**/queries/**/*.scm' }],
    };

    client = new LanguageClient('vscode-tree-sitter-dev-extension', serverOptions, clientOptions);
    // context.subscriptions.push(
    //     vscode.commands.registerCommand('vscode-tree-sitter-dev.printDocumentTree', () => printDocumentTree(client))
    // );
    client.start();
}

export function old_deactivate(): Promise<void> | undefined {
    if (!!client) {
        return client.stop();
    }
    return undefined;
}
