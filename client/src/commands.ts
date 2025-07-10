import * as vscode from 'vscode';
import { ExecuteCommandRequest } from 'vscode-languageclient';
import { LanguageClient } from 'vscode-languageclient/node';

export async function printDocumentTree(client: LanguageClient) {
    const uri = vscode.window.activeTextEditor.document.uri.toString();
    client.sendRequest(
        ExecuteCommandRequest.type, //
        {
            command: 'vscode-tree-sitter-dev.printDocumentTree',
            arguments: [uri],
        }
    );
}
