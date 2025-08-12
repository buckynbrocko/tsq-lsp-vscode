import { QueryMatch } from 'web-tree-sitter';
import { LintResult } from '.';
import { SyntaxError } from '../diagnostics';
import { DiagnosticError } from '../diagnostics/DiagnosticError';
import { DiagnosticWarning } from '../diagnostics/DiagnosticWarning';
import { TSNode } from '../reexports';
import { LSPRange } from '../reexports/LSPRange';
import { Capture } from '../TreeSitter';
import { FieldName } from '../typeChecking';
import { SingularMatchLint } from './SingularMatchLint';

export class MissingParametersMatchLint extends SingularMatchLint {
    static lintName = 'missing-parameters' as const;
    lintMatch(match: QueryMatch): LintResult {
        return match.captures
            .filter(capture => capture.name === this.class.lintName)
            .map(capture => capture.node)
            .map(node => {
                const type: string = this._typeFromNode(node);
                return SyntaxError(node, `Missing${type}parameters`);
            });
    }
    _typeFromNode(node: TSNode): string {
        const text: string | undefined = node.childForFieldName('type')?.text;
        switch (text) {
            case '?':
                return ' predicate ';
            case '!':
                return ' directive ';
            default:
                return ' ';
        }
    }
}

export class MissingFieldValueMatchLint extends SingularMatchLint {
    static lintName = 'missing-field-value' as const;
    lintMatch(match: QueryMatch): LintResult {
        const fieldDefinition = match.captures.at(0)?.node;
        if (!fieldDefinition) {
            return;
        }
        const fieldName: string | undefined = FieldName.fromNode(fieldDefinition);
        // fieldDefinition
        //     .childrenForFieldName('name')
        //     .filter(isNotNullish)
        //     .filter(n => n.isNamed)
        //     .at(0)?.text;
        let message: string = !fieldName ? 'Missing field value' : `Missing field value for field '${fieldName}'`;
        return SyntaxError(fieldDefinition, message);
    }
}

export class HangingCapture extends SingularMatchLint {
    static lintName = 'hanging-capture' as const;
    lintMatch(match: QueryMatch): LintResult {
        const node: TSNode | undefined = match.captures.at(0)?.node;
        if (!!node) {
            return SyntaxError(node, 'Missing capture name');
        }
        return;
    }
}
export class NonDescriptErrorNode extends SingularMatchLint {
    static lintName = 'lint.error-node' as const;
    lintMatch(match: QueryMatch): LintResult {
        const node: TSNode | undefined = match.captures.at(0)?.node;
        if (!!node) {
            return SyntaxError(node);
        }
        return;
    }
}
export class NonDescriptMissingNode extends SingularMatchLint {
    static lintName = 'lint.missing-node' as const;
    lintMatch(match: QueryMatch): LintResult {
        const node: TSNode | undefined = match.captures.at(0)?.node;
        if (!!node) {
            const nodeType: string = node.childForFieldName('name')?.text || 'unspecified';
            return SyntaxError(node, `Missing ${nodeType} node`);
        }
        return;
    }
}

export class EmptyContainer extends SingularMatchLint {
    static lintName = 'empty-container' as const;
    lintMatch(match: QueryMatch): LintResult {
        Capture.withName(match.captures, 'empty-container');
        const kind: string | undefined = Capture.withName(match.captures, 'empty-container')?.node.type;
        const open: TSNode | undefined = Capture.withName(match.captures, 'empty-container.open')?.node;
        const close: TSNode | undefined = Capture.withName(match.captures, 'empty-container.close')?.node;
        if (!open || !close || (kind !== 'list' && kind !== 'grouping')) {
            return;
        }
        const range = LSPRange.aroundNodes(open, close);
        return DiagnosticError(range, `Empty ${kind}`);
    }
}

export class PredicateName extends SingularMatchLint {
    static lintName = 'lint.predicate' as const;
    static readonly KNOWN_PREDICATES = [
        'eq',
        'any-eq',
        'any-not-eq',
        'not-eq',
        'any-of',
        'is',
        'any-is',
        'any-is-not',
        'is-not',
        'match',
        'any-match',
        'any-not-match',
        'not-match',
    ] as const;

    lintMatch(match: QueryMatch): LintResult {
        type PREDICATE = (typeof this.class.KNOWN_PREDICATES)[number];
        let identifier: TSNode | undefined = match.captures.filter(capture => capture.name === 'predicate.name').at(0)?.node;
        let name: PREDICATE | undefined = identifier?.text as PREDICATE | undefined;
        if (!!name && !this.class.KNOWN_PREDICATES.includes(name)) {
            return DiagnosticWarning(identifier!, `Unrecognized predicate '${name}'`);
        }
        return;
    }
}
