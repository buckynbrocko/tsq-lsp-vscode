import { FlatTypes } from '../src/Checkable/FlatTypes';
import { castUnchecked } from '../src/predicates';
import { Literal, TypeName } from '../src/typeChecking';
import { TypeEnvironment } from '../src/TypeEnvironment';
import { RUST, TSQ } from './NODE_TYPES';

describe('', () => {
    let TSQEnvironment: TypeEnvironment = TypeEnvironment.fromNodeTypes(TSQ);
    let RustEnvironment: TypeEnvironment = TypeEnvironment.fromNodeTypes(RUST);
    test.each(
        [
            '!',
            '"',
            '#',
            '(',
            ')',
            '*',
            '+',
            '.',
            '/',
            ':',
            '?',
            '@',
            'MISSING',
            '[',
            ']',
            '_',
            //
        ].map(castUnchecked<Literal>)
    )("hasLieral('%s')", literal => {
        expect(TSQEnvironment.hasLiteral(literal)).toBeTruthy();
    });

    test.each(
        [
            'comment',
            'escape_sequence',
            'identifier',
            'predicate_type',
            //
        ].map(castUnchecked<Literal>)
    )("isLiteral('%s') -> false", text => {
        expect(TSQEnvironment.hasLiteral(text)).toBeFalsy();
    });

    test.each(
        [
            'comment',
            'escape_sequence',
            'identifier',
            'predicate_type',
            //
        ].map(castUnchecked<TypeName>)
    )("hasType('%s') -> false", name => {
        let type = TSQEnvironment.getNamed(name);
        expect(TSQEnvironment.hasTypeName(name)).toBeTruthy();
    });

    test.each(
        [
            // '_declaration_statement',
            [
                '_expression',
                [
                    // '_expression',
                    // '_literal',
                    'array_expression',
                    'assignment_expression',
                    'async_block',
                    'await_expression',
                    'binary_expression',
                    'block',
                    'break_expression',
                    'call_expression',
                    'closure_expression',
                    'compound_assignment_expr',
                    'const_block',
                    'continue_expression',
                    'field_expression',
                    'for_expression',
                    'gen_block',
                    'generic_function',
                    'identifier',
                    'if_expression',
                    'index_expression',
                    'loop_expression',
                    'macro_invocation',
                    'match_expression',
                    'metavariable',
                    'parenthesized_expression',
                    'range_expression',
                    'reference_expression',
                    'return_expression',
                    'scoped_identifier',
                    'self',
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
                    'boolean_literal',
                    'char_literal',
                    'float_literal',
                    'integer_literal',
                    'raw_string_literal',
                    'string_literal',
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
        ].map(castUnchecked<[TypeName, TypeName[], Literal[]]>)
    )("flattenTypeNames('%s')", (name: TypeName, expectedNames: TypeName[], expectedLiterals: Literal[]) => {
        let type = RUST.filter(type_ => type_.named && type_.type === name)[0]!;
        const [namesSet, literalsSet] = FlatTypes.fromStubs([type], RUST);
        const [names, literals] = [[...namesSet], [...literalsSet]];
        expect(names.sort()).toStrictEqual(expectedNames.sort());
        expect(literals.sort()).toStrictEqual(expectedLiterals.sort());
    });

    test.each(
        [
            ['binary_expression', 'block'],
            //
        ].map(castUnchecked<[TypeName, TypeName]>)
    )('nodeMayHaveChildType', (parent: string, child: string) => {
        let type = RustEnvironment.getNamed(parent as TypeName);
        expect(type).toBeDefined();
        let canHaveChild = type!.typeNames.has(child as TypeName);
        if (!canHaveChild) {
            console.debug(type!.typeNames);
            console.debug(type!.literals);
        }
        expect(canHaveChild).toBeTruthy();
    });
});
