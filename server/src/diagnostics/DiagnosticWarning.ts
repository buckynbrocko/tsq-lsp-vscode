import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { LSPRange, TSNode } from '../junk_drawer';

export function DiagnosticWarning(node: TSNode, message: string): Diagnostic {
    return {
        message,
        range: LSPRange.fromNode(node),
        severity: DiagnosticSeverity.Warning,
    };
}
