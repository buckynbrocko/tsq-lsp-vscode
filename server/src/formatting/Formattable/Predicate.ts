import { QueryMatch } from 'web-tree-sitter';
import { firstOf, lastOf } from '../../itertools';
import { hasNextSibling, isNotType, nextSiblingIsNotType } from '../../predicates';
import { TSNode } from '../../reexports';
import { WTSRange } from '../../reexports/WTSRange';
import * as ts from '../../TreeSitter';
import { Captures } from '../../TreeSitter';
import { FormattingContext } from '../Context';
import { MaybeEdit, connect, format, space } from '../Edit';
import { FormattingStyle } from '../Style';
import { Formattable } from './Formattable';

export class Predicate extends Formattable {
    static primaryNodeType = 'predicate' as const;
    constructor(
        public open: TSNode,
        public predicateType: TSNode,
        public parameters: TSNode[],
        public close: TSNode,
        ...args: ConstructorParameters<typeof Formattable>
    ) {
        super(...args);
    }

    get inlinable(): boolean {
        return (
            !this.containsComments &&
            (this.style.predicates.maxInlineChildren === undefined ||
                this.parameters.length <= this.style.predicates.maxInlineChildren) &&
            this.parameters.every(parameter => this.childCanBeInlined(parameter))
        );
    }

    get indentationRange(): WTSRange | undefined {
        return this.inlinable ? undefined : WTSRange.betweenNodes(this.open, this.close);
    }

    static attemptNew(match: QueryMatch, style: FormattingStyle): Predicate | undefined {
        let node: TSNode | undefined = Predicate.primaryNode(match);
        let open: TSNode | undefined = TSNode.ofCaptureWithName(match, 'open');
        let predicateType: TSNode | undefined = TSNode.ofCaptureWithName(match, 'predicate-type');
        let parameters: TSNode[] = Captures.withName(match, 'parameter').map(ts.Capture.node);
        let close: TSNode | undefined = TSNode.ofCaptureWithName(match, 'close');

        if (!node || !open || !predicateType || !close) {
            return;
        }

        return new Predicate(open, predicateType, parameters, close, node, style);
    }

    _edits(context: FormattingContext): MaybeEdit | MaybeEdit[] {
        let edits: MaybeEdit[] = [];

        if (this.open.nextSibling?.type === '#') {
            edits.push(connect.next(this.open));
        }

        let firstParameter = firstOf(this.parameters);
        let actionableParameters = this.parameters
            .filter(isNotType('comment'))
            .filter(hasNextSibling)
            .filter(nextSiblingIsNotType('comment'));

        if (this.inlinable) {
            if (this.predicateType.nextSibling?.type === 'parameters' && firstParameter) {
                if (firstParameter.type === 'comment' && !context.style.comments.allowInline) {
                    edits.push(format.next(this.predicateType, 1, context.indentationAfter(this.predicateType)));
                } else {
                    edits.push(space.next(this.predicateType));
                }
            }
            actionableParameters.forEach(p => edits.push(space.next(p)));
        } else {
            edits.push(format.next(this.predicateType, 1, context.indentationAfter(this.predicateType)));
            actionableParameters.forEach(p => {
                const rowDistance = TSNode.rowsBetweenNext(p);
                const newlines = this.style.subLevel.fitNewlines(rowDistance);
                const indentation = context.indentationBefore(p);
                edits.push(format.next(p, newlines, indentation));
            });
        }

        let lastParameter = lastOf(this.parameters);
        if (this.close.previousSibling?.type === 'parameters' && lastParameter) {
            if (lastParameter.type === 'comment') {
                edits.push(format.previous(this.close, 1, context.indentationBefore(this.close)));
            } else {
                edits.push(connect.previous(this.close));
            }
        }

        return edits;
    }
}
