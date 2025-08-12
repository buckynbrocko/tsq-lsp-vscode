import { QueryMatch } from 'web-tree-sitter';
import { lastOf } from '../../itertools';
import { hasNextSibling, isNotNullish, isNotType, nextSiblingIsNotType, nextSiblingIsType } from '../../predicates';
import { TSNode } from '../../reexports';
import * as ts from '../../TreeSitter';
import { Captures } from '../../TreeSitter';
import { FormattingContext } from '../Context';
import { MaybeEdit, MaybeEdits, connect, format, space } from '../Edit';
import { FormattingStyle, NamedNodeStyle } from '../Style';
import { ChildBearing } from './ChildBearing';
import { Formattable } from './Formattable';

export class NamedNode extends ChildBearing {
    constructor(
        public open: TSNode,
        public name: TSNode,
        public children: TSNode[],
        public close: TSNode,
        ...args: ConstructorParameters<typeof Formattable>
    ) {
        super(...args);
    }

    static primaryNodeType = 'named-node' as const;
    static attemptNew(match: QueryMatch, style: FormattingStyle): NamedNode | undefined {
        let node: TSNode | undefined = NamedNode.primaryNode(match);
        let open: TSNode | undefined = TSNode.ofCaptureWithName(match, 'open');
        let name: TSNode | undefined = TSNode.ofCaptureWithName(match, 'name');
        let children: TSNode[] = Captures.withName(match, 'child').map(ts.Capture.node);
        let close: TSNode | undefined = TSNode.ofCaptureWithName(match, 'close');
        if (!node || !open || !name || !close) {
            return;
        }
        return new NamedNode(open, name, children, close, node, style);
    }

    get nodeStyle(): NamedNodeStyle {
        return this.style.namedNodes;
    }

    // get closingStyle(): ClosingStyle {
    //     return this.style.namedNodes.closingStyle;
    // }

    // get maxInlineChildren(): number | undefined {
    //     return this.style.namedNodes.maxInlineChildren;
    // }

    _edits(context: FormattingContext): MaybeEdit | MaybeEdits {
        let edits: MaybeEdit[] = [];

        if (
            // this.open.nextSibling?.type === 'identifier' ||
            // this.open.nextSibling?.type === 'anonymous_node'
            nextSiblingIsType('identifier', '_')(this.open)
        ) {
            edits.push(connect.next(this.open));
        }

        if (this.inlinable) {
            [this.name, ...this.children]
                .filter(isNotType('comment', ')'))
                .filter(hasNextSibling)
                .filter(nextSiblingIsNotType('comment', ')'))
                .forEach(n => {
                    edits.push(space.next(n));
                });
            edits.push(connect.pair(lastOf(this.children) ?? this.name, this.close));
        } else {
            let indentation = context.indentationAt(this.node.startIndex);
            [this.name, ...this.children]
                .filter(isNotNullish)
                .filter(hasNextSibling)
                .filter(nextSiblingIsNotType('comment', ')'))
                .forEach(n => {
                    if (n.type === '.' && !context.style.anchors.forceOntoNewline && this.childCanBeInlined(n.nextSibling)) {
                        edits.push(space.next(n));
                    } else {
                        const rowDifference: number = TSNode.rowsBetweenNext(n);
                        const newlines: number = this.style.subLevel.fitNewlines(rowDifference);
                        edits.push(format.next(n, newlines, indentation));
                    }
                });
            edits.push(this.uninlinedClose(context));
            // edits.push(this.uninlinedClose(this.close, context.style.namedNodeClosingStyle, context));
        }

        return edits;
    }
}
