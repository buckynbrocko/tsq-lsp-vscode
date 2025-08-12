import { TSNode, WTSRange } from '../../reexports';
import { FormattingContext } from '../Context';
import { connect, format, MaybeEdit } from '../Edit';
import { ClosingStyle, NodeStyle } from '../Style';
import { exceedsMaxInlineChildren } from '../utilities';
import { Formattable } from './Formattable';

export abstract class ChildBearing extends Formattable {
    abstract children: TSNode[];
    // abstract open: TSNode;
    abstract close: TSNode;

    get hasInlineChildLimit(): boolean {
        return this.maxInlineChildren !== undefined;
    }

    abstract get nodeStyle(): NodeStyle;

    get closingStyle(): ClosingStyle {
        return this.isTopLevel && this.nodeStyle.hangTopLevelClose ? ClosingStyle.Hanging : this.nodeStyle.closingStyle;
    }

    get maxInlineChildren(): number | undefined {
        return this.nodeStyle.maxInlineChildren;
    }

    get exceedsMaxInlinableChildren(): boolean {
        return exceedsMaxInlineChildren(this.children, this.maxInlineChildren);
    }

    get inlinable(): boolean {
        return (
            !this.exceedsMaxInlinableChildren &&
            !this.containsComments &&
            this.children.every(child => this.childCanBeInlined(child))
        );
    }

    get indentationRange(): WTSRange | undefined {
        // return this.inlinable ? undefined : WTSRange.betweenNodes(this.open, this.close);
        return this.inlinable ? undefined : WTSRange.fromNode(this.node);
    }

    inlinedClose() {}

    uninlinedClose(context: FormattingContext): MaybeEdit {
        switch (this.closingStyle) {
            case ClosingStyle.Connected:
                if (this.close.previousSibling?.type === 'comment') {
                    return format.previous(this.close, 1, context.indentationBefore(this.close));
                }
                return connect.previous(this.close);
            case ClosingStyle.Hanging:
                return format.previous(this.close, 1, context.indentationBefore(this.close, -1));
            case ClosingStyle.Tucked:
                return format.previous(this.close, 1, context.indentationBefore(this.close));
        }
    }
}
