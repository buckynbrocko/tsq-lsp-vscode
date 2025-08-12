import { QueryMatch } from 'web-tree-sitter';
import { TSNode } from '../../reexports';
import { FormattingContext } from '../Context';
import { MaybeEdit, connect } from '../Edit';
import { FormattingStyle } from '../Style';
import { Formattable, FormattableArgs } from './Formattable';

export class NegatedField extends Formattable {
    constructor(public bang: TSNode, ...args: FormattableArgs) {
        super(...args);
    }
    static primaryNodeType = 'negated-field' as const;
    static attemptNew(match: QueryMatch, style: FormattingStyle): NegatedField | undefined {
        let node: TSNode | undefined = NegatedField.primaryNode(match);
        let bang: TSNode | undefined = TSNode.ofCaptureWithName(match, 'bang');
        return node && bang && new NegatedField(bang, node, style);
    }
    _edits(context: FormattingContext): MaybeEdit {
        return connect.next(this.bang);
    }
}
