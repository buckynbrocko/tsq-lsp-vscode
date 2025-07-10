import { FlatTypes } from '../src/Checkable/FlatTypes';
import { SupertypeMap } from '../src/Checkable/Supertype';
import { castUnchecked } from '../src/predicates';
import { Literal, TypeName } from '../src/typeChecking';
import { RUST } from './NODE_TYPES';

describe('flatTypeNames', () => {
    test.each(['_expression'].map(castUnchecked<TypeName>))('', name => {
        let nodeType = RUST.filter(type => type.named).find(type => type.type === name);
        expect(nodeType).toBeDefined();
        let [names, _] = FlatTypes.fromStubs([nodeType!], RUST);
        expect(names.size).toBeGreaterThan(0);
    });

    test('parity', () => {
        let fromSupertypeMap = FlatTypes.fromSupertypeMap(RUST, SupertypeMap.fromNodeTypes(RUST));
        let fromStubs = FlatTypes.fromStubs(RUST, RUST);
        expect(fromSupertypeMap[0]).toEqual(fromStubs[0]);
        expect(fromSupertypeMap[1]).toEqual(fromStubs[1]);
    });

    test.each([
        //
        [
            '_expression',
            [
                'array_expression',
                'assignment_expression',
                'async_block',
                'await_expression',
                'binary_expression',
                'block',
                'boolean_literal',
                'break_expression',
                'call_expression',
                'char_literal',
                'closure_expression',
                'compound_assignment_expr',
                'const_block',
                'continue_expression',
                'field_expression',
                'float_literal',
                'for_expression',
                'gen_block',
                'generic_function',
                'identifier',
                'if_expression',
                'index_expression',
                'integer_literal',
                'loop_expression',
                'macro_invocation',
                'match_expression',
                'metavariable',
                'parenthesized_expression',
                'range_expression',
                'raw_string_literal',
                'reference_expression',
                'return_expression',
                'scoped_identifier',
                'self',
                'string_literal',
                'struct_expression',
                'try_block',
                'try_expression',
                'tuple_expression',
                'type_cast_expression',
                'unary_expression',
                'unit_expression',
                'unsafe_block',
                'while_expression',
                'yield_expression',
            ],
            [],
        ],
        [
            '_pattern',
            [
                // '_pattern',
                // '_literal_pattern',
                'captured_pattern',
                'const_block',
                'generic_pattern',
                'identifier',
                'macro_invocation',
                'mut_pattern',
                'or_pattern',
                'range_pattern',
                'ref_pattern',
                'reference_pattern',
                'remaining_field_pattern',
                'scoped_identifier',
                'slice_pattern',
                'struct_pattern',
                'tuple_pattern',
                'tuple_struct_pattern',
                'boolean_literal',
                'char_literal',
                'float_literal',
                'integer_literal',
                'negative_literal',
                'raw_string_literal',
                'string_literal',
            ],
            ['_'],
        ],
        [
            '_literal',
            ['boolean_literal', 'char_literal', 'float_literal', 'integer_literal', 'raw_string_literal', 'string_literal'],
            [],
        ],
        //
    ])('fromSupertypeStub(%s)', (name: string, expectedNamed: string[], expectedLiterals: string[]) => {
        let [names, literals] = FlatTypes.fromSupertypeStub({ type: name as TypeName | Literal, named: true }, RUST);
        expect([...names].sort()).toEqual(expectedNamed.sort());
        expect([...literals].sort()).toEqual(expectedLiterals.sort());
    });
});
