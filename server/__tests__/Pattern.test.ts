import { Pattern, PatternPath } from '../src/lints/StructuralLinting';

describe('Pattern', () => {
    test.each<[PatternPath, Pattern['type'] | '.' | undefined]>([
        [[0], 'List'],
        [[1], '.'],
        [[1, 0], undefined],
        [[2], 'AnonymousNode'],
        [[0, 0], 'MissingNode'], //
        [[0, 1], 'Grouping'], //
        [[0, 1, 0], '.'], //
        [[0, 1, 1], 'NamedNode'], //
    ])('indexByPath(%j) -> %o', (path: PatternPath, expectation: Pattern['type'] | '.' | undefined) => {
        let pattern: Pattern = {
            type: 'Grouping',
            members: [
                //
                {
                    type: 'List',
                    members: [
                        { type: 'MissingNode', name: 'missing_name' },
                        {
                            type: 'Grouping',
                            members: ['.', { type: 'NamedNode', name: 'a_named_node', children: [] }],
                        },
                    ],
                },
                '.',
                { type: 'AnonymousNode', isWildcard: true, name: '_' },
            ],
        };

        let indexed = Pattern.indexByPath(pattern, path);
        let result = typeof indexed === 'object' ? indexed.type : indexed;
        expect(result).toStrictEqual(expectation);
    });
});
