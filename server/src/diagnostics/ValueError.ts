import * as lsp from 'vscode-languageserver';
import { TSNode } from '../reexports';
import { isNotNullish } from '../predicates';
import { LSPRange } from '../reexports/LSPRange';
import { FieldName, TypeName } from '../typeChecking';
import { DiagnosticError } from './DiagnosticError';

export function ValueError(arg: TSNode | lsp.Range, message: string = 'Non-descript'): lsp.Diagnostic {
    return DiagnosticError(arg, 'Value Error - ' + message);
}

export namespace ValueError {
    export function unrecognizedNodeType(node: TSNode): lsp.Diagnostic {
        return ValueError(node, `Unrecognized node '${node.text}'`);
    }

    export function parentNodeHasNoChildOfType(parent: TypeName, child: TSNode): lsp.Diagnostic {
        return ValueError(child, `Parent node '${parent}' has no children node of type '${child.text}'`);
    }

    export function parentNodeHasNoFieldsOrChildren(parent: TypeName, child: TSNode): lsp.Diagnostic {
        return ValueError(child, `Parent node '${parent}' has no fields/children`);
    }

    export function requiredNegatedField(field: FieldName, parent: TypeName, negatedField: TSNode): lsp.Diagnostic {
        return ValueError(negatedField, `Negated field '${field}' is required on node '${parent}'`);
    }

    export function typeHasNoFieldOfName(parent: TypeName, field: TSNode): lsp.Diagnostic {
        return ValueError(field, `'${parent}' node has no field named '${field.text}'`);
    }

    export function invalidFieldName(identifier: TSNode): lsp.Diagnostic {
        return ValueError(identifier, `No node has a field named '${identifier.text}'`);
    }

    export function typeHasNoFields(parent: TypeName, field: TSNode): lsp.Diagnostic {
        return ValueError(field, `'${parent}' node has no fields`);
    }

    export function invalidFieldValue(field: FieldName, value: TSNode): lsp.Diagnostic {
        const textAndRange: [string, lsp.Range] | undefined = namedNodeTextAndRange(value);
        if (!textAndRange) {
            return ValueError(value, `Invalid value '${value.text}' for field '${field}'`);
        }
        const [text, range] = textAndRange;
        return ValueError(range, `Invalid value '${text}' for field '${field}'`);
    }

    function namedNodeTextAndRange(node: TSNode): [string, lsp.Range] | undefined {
        const name: string | undefined = node.childForFieldName('name')?.text;
        if (!name) {
            return;
        }
        const open: TSNode | undefined = node.children.filter(isNotNullish).find(child => child.type === '(');
        if (!open) {
            return;
        }
        const close: TSNode | undefined = node.children.filter(isNotNullish).find(child => child.type === ')');
        if (!close) {
            return;
        }
        const length: number = close?.endIndex - open?.startIndex;
        if (length < 1) {
            return;
        }
        const text = `(${name})`;
        const range = LSPRange.aroundNodes(open, close);
        return [text, range];
    }

    export function EmptyList(list: TSNode): lsp.Diagnostic {
        return ValueError(list, 'List is empty');
    }

    export function EmptyGrouping(list: TSNode): lsp.Diagnostic {
        return ValueError(list, 'Grouping is empty');
    }
}
