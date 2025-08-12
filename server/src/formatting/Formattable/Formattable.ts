import { QueryMatch } from 'web-tree-sitter';
import { TSNode } from '../../reexports';
import { WTSRange } from '../../reexports/WTSRange';
import { LSPTextEdit } from '../../TextEditSimulator';
import { FormattingContext } from '../Context';
import { connect, format, MaybeEdit, MyEdit, remove, space } from '../Edit';
import { FormattingStyle } from '../Style';
import { childCanBeInlined } from '../utilities';

export type FormattableConstructor<T extends Formattable = Formattable> = (
    match: QueryMatch,
    style: FormattingStyle
) => T | undefined;

export type FormattableArgs = ConstructorParameters<typeof Formattable>;

export class Formattable {
    constructor(public node: TSNode, public style: FormattingStyle) {}
    static primaryNodeType?: string | undefined = undefined;

    get inlinable(): boolean {
        return !this.containsComments;
    }

    get indentationRange(): WTSRange | undefined {
        return undefined;
    }

    get isTopLevel(): boolean {
        return this.node.parent?.type === 'program';
    }

    childCanBeInlined(child: TSNode): boolean {
        return childCanBeInlined(child, this.style);
    }

    static attemptNew(match: QueryMatch, options: FormattingStyle): InstanceType<typeof Formattable> | undefined {
        let node = Formattable.primaryNode(match);
        if (!node) {
            return;
        }
        return new Formattable(node, options);
    }

    static primaryNode(match: QueryMatch): TSNode | undefined {
        return this.primaryNodeType ? TSNode.ofCaptureWithName(match, this.primaryNodeType) : match.captures.at(0)?.node;
    }

    get followsComment(): boolean {
        return this.node.previousSibling?.type === 'comment';
    }

    get precedesComment(): boolean {
        return this.node.nextSibling?.type === 'comment';
    }

    _edits(context: FormattingContext): MaybeEdit | MaybeEdit[] {
        return [format.next(this.node, 1, context.indentationAfter(this.node))];
    }

    edits(context: FormattingContext): MyEdit[] {
        let edits = this._edits(context);
        return (Array.isArray(edits) ? edits : [edits]).filter(MyEdit.is);
    }

    LSPEdits(context: FormattingContext): LSPTextEdit[] {
        return this.edits(context).map(edit => edit.toTextEdit());
    }

    spacePrevious(spaces: number = 1): MaybeEdit {
        return this.followsComment ? undefined : space.previous(this.node, spaces);
    }

    spaceNext(spaces: number = 1): MaybeEdit {
        return this.precedesComment ? undefined : space.next(this.node, spaces);
    }

    connectPrevious(): MaybeEdit {
        return this.followsComment ? undefined : connect.previous(this.node);
    }

    connectNext(): MaybeEdit {
        return this.precedesComment ? undefined : connect.next(this.node);
    }

    removeBefore(): MaybeEdit {
        return remove.before(this.node);
    }

    removeAfter(node: TSNode): MaybeEdit {
        return remove.after(node, this.node);
    }

    formatPrevious(newlines: number, spaces: number): MaybeEdit {
        return format.previous(this.node, newlines, spaces);
    }

    formatNext(newlines: number, spaces: number): MaybeEdit {
        return format.next(this.node, newlines, spaces);
    }

    get containsComments(): boolean {
        return !!this.node.descendantsOfType('comment').length;
    }
}
