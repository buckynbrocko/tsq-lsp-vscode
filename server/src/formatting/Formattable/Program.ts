import { QueryMatch } from 'web-tree-sitter';
import { TSNode } from '../../reexports';
import * as ts from '../../TreeSitter';
import { FormattingContext } from '../Context';
import { MaybeEdit, linesBetween, space } from '../Edit';
import { FormattingStyle } from '../Style';
import { Formattable, FormattableArgs } from './Formattable';

export class Program extends Formattable {
    static primaryNodeType = 'program';
    constructor(public children: TSNode[], ...args: FormattableArgs) {
        super(...args);
    }
    static attemptNew(match: QueryMatch, style: FormattingStyle): Program | undefined {
        let node = ts.Capture.withName(match, 'program')?.node;
        if (!node) {
            return;
        }
        let children = ts.Captures.withName(match, 'child').map(ts.Capture.node).sort(TSNode.CompareSiblings);
        return new Program(children, node, style);
    }

    _edits(context: FormattingContext): MaybeEdit[] {
        let edits: MaybeEdit[] = [this.removeBefore()];

        for (let child of this.children) {
            if (!child.nextSibling) {
                if (context.style.options.trimFinalNewlines) {
                    edits.push(this.removeAfter(child));
                }
                continue;
            }
            let rowDifference = TSNode.Pair.rowDifferenceBetween(child, child.nextSibling);
            if (
                child.type === 'comment' ||
                child.nextSibling.type !== 'comment' ||
                !context.style.comments.allowInline ||
                !!rowDifference
            ) {
                let newlines = this.style.topLevel.fitNewlines(rowDifference);
                edits.push(linesBetween.next(child, newlines));
            } else {
                edits.push(space.next(child));
            }
        }

        return edits;
    }
}
