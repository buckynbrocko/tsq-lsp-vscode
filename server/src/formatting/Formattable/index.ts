import { QueryMatch } from 'web-tree-sitter';
import { isNotNullish } from '../../predicates';
import { FormattingStyle } from '../Style';
import { Capture } from './Capture';
import { Comment } from './Comment';
import { FieldDefinition } from './FieldDefinition';
import { Formattable, FormattableConstructor } from './Formattable';
import { Grouping } from './Grouping';
import { List } from './List';
import { NamedNode } from './NamedNode';
import { NegatedField } from './NegatedField';
import { Predicate } from './Predicate';
import { Program } from './Program';
import { Quantifier } from './Quantifier';

export { Capture } from './Capture';
export { Comment } from './Comment';
export { FieldDefinition } from './FieldDefinition';
export { Formattable } from './Formattable';
export { Grouping } from './Grouping';
export { List } from './List';
export { NamedNode } from './NamedNode';
export { NegatedField } from './NegatedField';
export { Predicate } from './Predicate';
export { Program } from './Program';
export { Quantifier } from './Quantifier';

export function fromMatches(matches: QueryMatch[], style: FormattingStyle): Formattable[] {
    return matches
        .map(match => {
            let name = match.captures.at(0)?.name;
            let constructor: FormattableConstructor | undefined;
            switch (name) {
                case 'program':
                    constructor = Program.attemptNew;
                    break;
                case 'capture':
                case 'sub-capture':
                    constructor = Capture.attemptNew;
                    break;
                case 'quantifier':
                    constructor = Quantifier.attemptNew;
                    break;
                case 'negated-field':
                    constructor = NegatedField.attemptNew;
                    break;
                case 'field-definition':
                    constructor = FieldDefinition.attemptNew;
                    break;
                case 'sub-comment':
                    constructor = Comment.attemptNew;
                    break;
                case 'named-node':
                    constructor = NamedNode.attemptNew;
                    break;
                case 'list':
                    constructor = List.attemptNew;
                    break;
                case 'grouping':
                    constructor = Grouping.attemptNew;
                    break;
                case 'predicate':
                    constructor = Predicate.attemptNew;
                    break;
                case undefined:
                    return;
                default:
                    console.warn(`unhandled formatting match name "${name}"`);
                    return;
            }
            return constructor && constructor(match, style);
        })
        .filter(isNotNullish);
}
