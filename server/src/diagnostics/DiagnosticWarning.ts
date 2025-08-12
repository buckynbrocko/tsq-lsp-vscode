import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { TSNode } from '../reexports';
import { LSPRange } from '../reexports/LSPRange';

export function DiagnosticWarning(node: TSNode, message: string): Diagnostic {
    return {
        message,
        range: LSPRange.fromNode(node),
        severity: DiagnosticSeverity.Warning,
    };
}
