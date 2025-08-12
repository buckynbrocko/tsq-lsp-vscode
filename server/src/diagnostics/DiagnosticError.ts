import * as lsp from 'vscode-languageserver';
import { Diagnostic } from 'vscode-languageserver';
import { TSNode } from '../reexports';
import { LSPRange } from '../reexports/LSPRange';
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
