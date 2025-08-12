import { QueryMatch } from 'web-tree-sitter';
import { FormattingContext } from '../Context';
import { MaybeEdit, space } from '../Edit';
import { FormattingStyle } from '../Style';
import { Formattable } from './Formattable';

export class Capture extends Formattable {
    static primaryNodeType = 'capture' as const;
    static attemptNew(match: QueryMatch, style: FormattingStyle): Capture | undefined {
        let node = Capture.primaryNode(match);
        return node && new Capture(node, style);
    }

    _edits(context: FormattingContext): MaybeEdit {
        return space.previous(this.node);
    }
}
