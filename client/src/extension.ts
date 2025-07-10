import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { printDocumentTree } from './commands';

const DEBUG = true;
let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    debug('Activating extension');

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
    debug('ACTIVATED');
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-tree-sitter-dev.printDocumentTree', () => printDocumentTree(client))
    );
    client.start();
    debug('Extension activated');
}

export function deactivate(): Promise<void> | undefined {
    debug('Deactivating extension');
    if (!!client) {
        return client.stop();
    }
    return undefined;
}

function debug(message?: any, ...optionalParams: any[]) {
    DEBUG && console.debug(message, ...optionalParams);
}
