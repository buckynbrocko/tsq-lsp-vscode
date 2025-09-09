import * as vscode from 'vscode';
import { ExecuteCommandRequest } from 'vscode-languageclient';
import { LanguageClient } from 'vscode-languageclient/node';
import { EXTENSION_NAME } from './extension';

enum Command {
    PRINT_DOCUMENT_TREE = 'print-document-tree',
    RELOAD_NODE_TYPES = 'reload-node-types',
    REFRESH_SEMANTIC_TOKENS = 'refresh-semantic-tokens',
}

type ExtensionCommand = `${typeof EXTENSION_NAME}.${Command}`;

export function requestCommandExecution(client: LanguageClient | undefined, command_: Command, ...args: any[]) {
    const command: ExtensionCommand = `${EXTENSION_NAME}.${command_}`;
    client?.sendRequest(ExecuteCommandRequest.type, {
        command,
        arguments: args,
    });
}

export async function printDocumentTree(clients: Map<string, LanguageClient>) {
    const uri: vscode.Uri = vscode.window.activeTextEditor.document.uri;
    let client = getClient(clients, uri);
    requestCommandExecution(client, Command.PRINT_DOCUMENT_TREE, uri.toString());
    // client?.sendRequest(
    //     ExecuteCommandRequest.type, //
    //     {
    //         command: 'tsq-lsp-vscode.print-document-tree',
    //         arguments: [uri.toString()],
    //     }
    // );
}

export async function reloadNodeTypes(clients: Map<string, LanguageClient>) {
    let client = getClient(clients);
    requestCommandExecution(client, Command.RELOAD_NODE_TYPES);
    // client?.sendRequest(
    //     ExecuteCommandRequest.type, //
    //     {
    //         command: 'tsq-lsp-vscode.reload-node-types',
    //         // arguments: [uri],
    //     }
    // );
}

export async function refreshSemanticTokens(clients: Map<string, LanguageClient>) {
    const uri = vscode.window.activeTextEditor.document.uri;
    let client = getClient(clients, uri);
    requestCommandExecution(client, Command.REFRESH_SEMANTIC_TOKENS, uri.toString());
    // client?.sendRequest(ExecuteCommandRequest.type, {
    //     command: 'tsq-lsp-vscode.refresh-semantic-tokens',
    //     arguments: [uri.toString()],
    // });
}

export function getClient(clients: Map<string, LanguageClient>, uri?: vscode.Uri): LanguageClient | undefined {
    uri = uri ?? vscode.window.activeTextEditor.document.uri;
    let client: LanguageClient | undefined = [...clients.entries()]
        .filter(([workspace, _]) => uri.toString().startsWith(workspace))
        .map(([_, client]) => client)
        .at(0);
    if (!client) {
        console.error(`Failed to find client to execute command for URI "${uri}"`);
        return;
    }
    return client;
}
