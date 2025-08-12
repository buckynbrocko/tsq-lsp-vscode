import * as vscode from 'vscode';
import { ExecuteCommandRequest } from 'vscode-languageclient';
import { LanguageClient } from 'vscode-languageclient/node';

export async function printDocumentTree(clients: Map<string, LanguageClient>) {
    const uri: vscode.Uri = vscode.window.activeTextEditor.document.uri;
    let client = getClient(clients, uri);
    client?.sendRequest(
        ExecuteCommandRequest.type, //
        {
            command: 'vscode-tree-sitter-dev.print-document-tree',
            arguments: [uri.toString()],
        }
    );
}

export async function reloadNodeTypes(clients: Map<string, LanguageClient>) {
    let client = getClient(clients);
    client?.sendRequest(
        ExecuteCommandRequest.type, //
        {
            command: 'vscode-tree-sitter-dev.reload-node-types',
            // arguments: [uri],
        }
    );
}

export async function refreshSemanticTokens(clients: Map<string, LanguageClient>) {
    const uri = vscode.window.activeTextEditor.document.uri;
    let client = getClient(clients, uri);
    client?.sendRequest(ExecuteCommandRequest.type, {
        command: 'vscode-tree-sitter-dev.refresh-semantic-tokens',
        arguments: [uri.toString()],
    });
}

function getClient(clients: Map<string, LanguageClient>, uri?: vscode.Uri): LanguageClient | undefined {
    uri = uri ?? vscode.window.activeTextEditor.document.uri;
    let client: LanguageClient | undefined = [...clients.entries()]
        .filter(([workspace, _]) => uri.toString().startsWith(workspace))
        .map(([_, client]) => client)
        .at(0);
    if (!client) {
        console.error(`Failed to find client to execute command for URI "${uri}"`);
    }
    return client;
}
