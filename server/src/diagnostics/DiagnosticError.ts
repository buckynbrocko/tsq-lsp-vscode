import * as lsp from 'vscode-languageserver';
import { Diagnostic } from 'vscode-languageserver';
import { LSPRange, TSNode } from '../junk_drawer';
export * from './SyntaxError';
export * from './ValueError';

export function DiagnosticError(range: lsp.Range, message: string): Diagnostic;
export function DiagnosticError(node: TSNode, message: string): Diagnostic;
export function DiagnosticError(arg: TSNode | lsp.Range, message: string): Diagnostic;
export function DiagnosticError(arg: TSNode | lsp.Range, message: string = 'Non-descript error'): Diagnostic {
    const range = lsp.Range.is(arg) ? arg : LSPRange.fromNode(arg);
    return {
        message,
        range,
    };
}
