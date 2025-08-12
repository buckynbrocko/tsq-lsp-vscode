import { QueryMatch } from 'web-tree-sitter';
import { TSNode } from '../../reexports';
import { FormattingContext } from '../Context';
import { MaybeEdits, connect, space } from '../Edit';
import { FormattingStyle } from '../Style';
import { Formattable, FormattableArgs } from './Formattable';

export class FieldDefinition extends Formattable {
    static primaryNodeType = 'field-definition' as const;
    constructor(public colon: TSNode, ...args: FormattableArgs) {
        super(...args);
    }
    get inlinable(): boolean {
        return !this.containsComments && !!this.colon.nextSibling && this.childCanBeInlined(this.colon.nextSibling);
    }

    static attemptNew(match: QueryMatch, style: FormattingStyle): FieldDefinition | undefined {
        let node: TSNode | undefined = FieldDefinition.primaryNode(match);
        let colon: TSNode | undefined = TSNode.ofCaptureWithName(match, 'colon');
        // let value: TSNode | undefined = NodeOfCaptureWithName(match, 'value');
        // return node && colon && value && new FieldDefinition(node, colon, value);
        return node && colon && new FieldDefinition(colon, node, style);
    }
    _edits(context: FormattingContext): MaybeEdits {
        return [
            this.colon.previousSibling?.type !== 'identifier' ? undefined : connect.previous(this.colon),
            this.colon.nextSibling?.type === 'comment' ? undefined : space.next(this.colon),
        ];
    }
}
