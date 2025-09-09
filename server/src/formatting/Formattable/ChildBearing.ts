import { TSNode, WTSRange } from '../../reexports';
import { FormattingContext } from '../Context';
import { connect, format, MaybeEdit, space } from '../Edit';
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
        return this.isTopLevel && this.nodeStyle.hangTopLevelClose
            ? ClosingStyle.OuterIndentation
            : this.nodeStyle.closingStyle;
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
        if (this.close.previousSibling?.type === '.') {
            console.log(this.node.type);
            console.log(this.close.previousSibling.type);
            console.log(this.closingStyle);
            console.log(`spaceBeforeClose: ${context.style.anchors.spaceBeforeClose}`);
        }
        switch (this.closingStyle) {
            case ClosingStyle.Inline:
                if (this.close.previousSibling?.type === 'comment') {
                    console.log('COMMENT');
                    return format.previous(this.close, 1, context.indentationBefore(this.close));
                }
                if (this.close.previousSibling?.type === '.' && context.style.anchors.spaceBeforeClose) {
                    console.log('HERE');
                    return space.previous(this.close);
                }
                console.log('DEFAULT');
                return connect.previous(this.close);
            case ClosingStyle.OuterIndentation:
                this.close.previousSibling?.type === '.' && console.log('OUTER');
                return format.previous(this.close, 1, context.indentationBefore(this.close, -1));
            case ClosingStyle.InnerIndentation:
                this.close.previousSibling?.type === '.' && console.log('INNER');
                return format.previous(this.close, 1, context.indentationBefore(this.close));
            default:
                console.error(`Invalid closing style '${this.closingStyle}'`);
                return undefined;
        }
    }
}
