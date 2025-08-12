import { QueryMatch } from 'web-tree-sitter';
import { hasNextSibling, isNotType, nextSiblingIsNotType } from '../../predicates';
import { TSNode } from '../../reexports';
import * as ts from '../../TreeSitter';
import { Captures } from '../../TreeSitter';
import { FormattingContext } from '../Context';
import { MaybeEdit, MaybeEdits, connect, format, space } from '../Edit';
import { FormattingStyle, GroupingStyle } from '../Style';
import { ChildBearing } from './ChildBearing';
import { Formattable } from './Formattable';

export class Grouping extends ChildBearing {
    static primaryNodeType = 'grouping' as const;
    constructor(
        public open: TSNode,
        public children: TSNode[],
        public close: TSNode,
        ...args: ConstructorParameters<typeof Formattable>
    ) {
        super(...args);
    }

    get nodeStyle(): GroupingStyle {
        return this.style.groupings;
    }

    static attemptNew(match: QueryMatch, style: FormattingStyle): Grouping | undefined {
        let node: TSNode | undefined = Grouping.primaryNode(match);
        let open: TSNode | undefined = TSNode.ofCaptureWithName(match, 'open');
        let children: TSNode[] = Captures.withName(match, 'child').map(ts.Capture.node);
        let close: TSNode | undefined = TSNode.ofCaptureWithName(match, 'close');
        if (!node || !open || !close) {
            return;
        }
        return new Grouping(open, children, close, node, style);
    }

    _edits(context: FormattingContext): MaybeEdits {
        let edits: MaybeEdit[] = [];

        if (this.open.nextSibling?.type === 'identifier') {
            edits.push(connect.next(this.open));
        }

        if (this.inlinable) {
            edits.push(connect.next(this.open));
            this.children
                .filter(hasNextSibling)
                .filter(nextSiblingIsNotType(')'))
                .forEach(n => edits.push(space.next(n)));
            edits.push(connect.previous(this.close));
        } else {
            let indentation = context.indentationAt(this.node.startIndex);
            [this.open, ...this.children]
                .filter(isNotType('comment'))
                .filter(hasNextSibling)
                .filter(nextSiblingIsNotType('comment', ')'))
                .forEach(n => {
                    const rowDifference: number = TSNode.rowsBetweenNext(n);
                    const newlines: number = this.style.subLevel.fitNewlines(rowDifference);
                    edits.push(format.next(n, newlines, indentation));
                });
            edits.push(this.uninlinedClose(context));
            // if (this.isTopLevel && this.nodeStyle.hangTopLevelClose) {
            //     edits.push(this.uninlinedClose(context, ClosingStyle.Hanging));
            // } else {
            //     edits.push(this.uninlinedClose(this.close, context.style.groupingClosingStyle, context));
            // }
        }

        return edits;
    }
}
