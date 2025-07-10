import { argv } from 'process';
import { createConnection } from 'vscode-languageserver/node';
import { LSPServer } from './lsp';

const extensionPath: string = argv[2]!;
// debug(`Extension path: '${extensionPath}'`);

// debug('Creating connection');
const connection = createConnection();
// debug('Connection created');
let server: LSPServer = new LSPServer(connection, extensionPath);

connection.listen();
connection.client;
server.supports;
connection.window;
