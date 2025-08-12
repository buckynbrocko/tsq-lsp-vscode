import { QueryMatch } from 'web-tree-sitter';
import { FormattingContext } from '../Context';
import { MaybeEdit } from '../Edit';
import { FormattingStyle } from '../Style';
import { Formattable } from './Formattable';

export class Quantifier extends Formattable {
    static primaryNodeType = 'quantifier' as const;
    static attemptNew(match: QueryMatch, style: FormattingStyle): Quantifier | undefined {
        let node = Quantifier.primaryNode(match);
        return node && new Quantifier(node, style);
    }

    _edits(context: FormattingContext): MaybeEdit {
        return this.connectPrevious();
    }
}
