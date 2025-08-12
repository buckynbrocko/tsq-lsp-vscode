import { Diagnostic } from 'vscode-languageserver';
import { TSNode } from '../reexports';
import { DiagnosticWarning } from './DiagnosticWarning';

export namespace Warning {
    export function unrecognizedPredicate(identifier: TSNode): Diagnostic {
        return DiagnosticWarning(identifier, `Unrecognized predicate '${identifier.text}'`);
    }

    export function redundantNegatedField(parentName: string, fieldName: string, negatedField: TSNode): Diagnostic {
        return DiagnosticWarning(
            negatedField,
            `Redundant negated field - ${parentName}' node has no field named '${fieldName}'`
        );
    }
}
