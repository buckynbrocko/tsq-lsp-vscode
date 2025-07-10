import * as lsp from 'vscode-languageserver';
import { Diagnostic } from 'vscode-languageserver';
import { TSNode } from '../junk_drawer';
import { isNotNullish } from '../predicates';
import { DiagnosticError } from './DiagnosticError';

export function SyntaxError(arg: TSNode | lsp.Range, message: string = 'Non-descript'): Diagnostic {
    return DiagnosticError(arg, 'Syntax Error - ' + message);
}

export namespace SyntaxError {
    export function nonDescript(node: TSNode): Diagnostic {
        return SyntaxError(node, 'Non-descript');
    }

    export function missingNode(node: TSNode): Diagnostic {
        let nodeType: string = node.childForFieldName('name')?.text || 'unspecified';
        return SyntaxError(node, `Missing ${nodeType} node`);
    }

    export function missingFieldValue(fieldDefinition: TSNode): Diagnostic {
        const fieldName: string | undefined = fieldDefinition
            .childrenForFieldName('name')
            .filter(isNotNullish)
            .filter(n => n.isNamed)
            .at(0)?.text;
        let message: string = !!fieldName ? `Missing field value for field '${fieldName}'` : 'Missing field value';
        return SyntaxError(fieldDefinition, message);
    }

    export function missingPredicateParameters(predicate: TSNode): Diagnostic {
        return SyntaxError(predicate, 'Missing predicate parameters');
    }

    export function missingDirectiveParameters(directive: TSNode): Diagnostic {
        return SyntaxError(directive, 'Missing directive parameters');
    }

    export function hangingCapture(at: TSNode): Diagnostic {
        return SyntaxError(at, 'Missing capture name');
    }
}

export function nonDescriptSyntaxError(node: TSNode): Diagnostic {
    return SyntaxError(node, 'Non-descript');
}

export function missingNode(node: TSNode): Diagnostic {
    let nodeType: string = node.childForFieldName('name')?.text || 'unspecified';
    return SyntaxError(node, `Missing ${nodeType} node`);
}

export function missingFieldValue(fieldDefinition: TSNode): Diagnostic {
    const fieldName: string | undefined = fieldDefinition
        .childrenForFieldName('name')
        .filter(isNotNullish)
        .filter(n => n.isNamed)
        .at(0)?.text;
    let message: string = !!fieldName ? `Missing field value for field '${fieldName}'` : 'Missing field value';
    return SyntaxError(fieldDefinition, message);
}

export function missingPredicateParameters(predicate: TSNode): Diagnostic {
    return SyntaxError(predicate, 'Missing predicate parameters');
}

export function missingDirectiveParameters(directive: TSNode): Diagnostic {
    return SyntaxError(directive, 'Missing directive parameters');
}

export function hangingCapture(at: TSNode): Diagnostic {
    return SyntaxError(at, 'Missing capture name');
}
