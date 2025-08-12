import { QueryMatch } from 'web-tree-sitter';
import { hasNextSibling, hasPreviousSibling } from '../../predicates';
import { TSNode } from '../../reexports';
import { FormattingContext } from '../Context';
import { MaybeEdit, MaybeEdits } from '../Edit';
import { FormattingStyle } from '../Style';
import { Formattable } from './Formattable';

export class Comment extends Formattable {
    static primaryNodeType = 'comment' as const;
    static attemptNew(match: QueryMatch, style: FormattingStyle): Comment | undefined {
        const node: TSNode | undefined = Comment.primaryNode(match);
        return node && new Comment(node, style);
    }

    _edits(context: FormattingContext): MaybeEdits {
        let edits: MaybeEdit[] = [];
        let indentation: number | undefined;
        if (hasPreviousSibling(this.node) && !this.followsComment) {
            const rowDifference: number = TSNode.rowsBetweenPrevious(this.node);
            if (context.style.comments.allowInline && rowDifference === 0) {
                edits.push(this.spacePrevious());
            } else {
                const xdent: 1 | 0 = this.node.previousSibling.type === 'capture' ? 1 : 0;
                indentation = context.indentationBefore(this.node, xdent);
                const newlines: number = this.style.subLevel.fitNewlines(rowDifference);
                edits.push(this.formatPrevious(newlines, indentation));
            }
        }

        if (hasNextSibling(this.node)) {
            const rowDifference: number = TSNode.rowsBetweenNext(this.node);
            const xdent: 1 | 0 = this.node.nextSibling.type === 'capture' ? 1 : 0;
            indentation = context.indentationBefore(this.node, xdent);
            const newlines: number = this.style.subLevel.fitNewlines(rowDifference);
            edits.push(this.formatNext(rowDifference, indentation));
        }

        return edits;
    }
}
