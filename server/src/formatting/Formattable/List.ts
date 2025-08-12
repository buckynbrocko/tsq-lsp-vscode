import { QueryMatch } from 'web-tree-sitter';
import { hasNextSibling, isNotType, nextSiblingIsNotType } from '../../predicates';
import { TSNode } from '../../reexports';
import * as ts from '../../TreeSitter';
import { Captures } from '../../TreeSitter';
import { FormattingContext } from '../Context';
import { MaybeEdit, MaybeEdits, connect, format, space } from '../Edit';
import { FormattingStyle, ListStyle } from '../Style';
import { ChildBearing } from './ChildBearing';
import { Formattable } from './Formattable';

export class List extends ChildBearing {
    constructor(
        public open: TSNode,
        public children: TSNode[],
        public close: TSNode,
        ...args: ConstructorParameters<typeof Formattable>
    ) {
        super(...args);
    }

    static primaryNodeType = 'list' as const;
    static attemptNew(match: QueryMatch, style: FormattingStyle): List | undefined {
        let node: TSNode | undefined = List.primaryNode(match);
        let open: TSNode | undefined = TSNode.ofCaptureWithName(match, 'open');
        let children: TSNode[] = Captures.withName(match, 'child').map(ts.Capture.node);
        let close: TSNode | undefined = TSNode.ofCaptureWithName(match, 'close');
        if (!node || !open || !close) {
            return;
        }
        return new List(open, children, close, node, style);
    }

    get nodeStyle(): ListStyle {
        return this.style.lists;
    }

    // get closingStyle(): ClosingStyle {
    //     return this.style.listClosingStyle;
    // }

    // get maxInlineChildren(): number | undefined {
    //     return this.style.maxInlineListElements;
    // }

    _edits(context: FormattingContext): MaybeEdit | MaybeEdits {
        let edits: MaybeEdit[] = [];

        if (this.open.nextSibling?.type === 'identifier') {
            edits.push(connect.next(this.open));
        }

        if (this.inlinable) {
            edits.push(connect.next(this.open));
            this.children
                .filter(hasNextSibling)
                .filter(nextSiblingIsNotType(']'))
                .forEach(n => edits.push(space.next(n)));
            edits.push(connect.previous(this.close));
        } else {
            let indentation = context.indentationAt(this.node.startIndex);
            // let indentation = context.indentationAfter(this.open);
            [this.open, ...this.children]
                .filter(isNotType('comment'))
                .filter(hasNextSibling)
                .filter(nextSiblingIsNotType('comment', ']'))
                .forEach(n => {
                    const rowDifference: number = TSNode.rowsBetweenNext(n);
                    const newlines: number = this.style.subLevel.fitNewlines(rowDifference);
                    edits.push(format.next(n, newlines, indentation));
                });
            edits.push(this.uninlinedClose(context));
            // edits.push(this.uninlinedClose(this.close, context.style.listClosingStyle, context));
        }

        return edits;
    }
}
