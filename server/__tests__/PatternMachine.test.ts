import { Pattern, PatternMachine } from '../src/lints/StructuralLinting';

describe('PatternMachine', () => {
    let pattern: Pattern;
    let patternMachine: PatternMachine;
    beforeAll(() => {
        pattern = {
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
        patternMachine = new PatternMachine(pattern);
    });

    test.each([
        //
        [0, undefined],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 1],
        [5, 1],
        [6, 5],
        [7, 5],
    ])('parentIndex(%i) -> %o', (childIndex: number, expectation: number | undefined) => {
        let result = patternMachine.getParentIndex(childIndex);
        expect(result).toEqual(expectation);
    });
    test.each([
        //
        [0, [1, 2, 3]],
        [1, [4, 5]],
        [2, []],
        [3, []],
        [4, []],
        [5, [6, 7]],
        [6, []],
        [7, []],
    ])('getChildrenIndixes(%i) -> %j', (parentIndex: number, expectation: number[]) => {
        let result = patternMachine.getChildrenIndices(parentIndex);
        expect(result).toEqual(expectation);
    });
    test.each([
        //
        [0, undefined],
        [1, undefined],
        [2, 1],
        [3, 2],
        [4, undefined],
        [5, 4],
        [6, undefined],
        [7, 6],
    ])('previousSiblingIndex(%i) -> %j', (parentIndex: number, expectation: number | undefined) => {
        let result = patternMachine.previousSiblingIndex(parentIndex);
        expect(result).toEqual(expectation);
    });
    test.each([
        //
        [0, undefined],
        [1, 2],
        [2, 3],
        [3, undefined],
        [4, 5],
        [5, undefined],
        [6, 7],
        [7, undefined],
    ])('nextSiblingIndex(%i) -> %j', (parentIndex: number, expectation: number | undefined) => {
        let result = patternMachine.nextSiblingIndex(parentIndex);
        expect(result).toEqual(expectation);
    });
    test.each([
        //
        [0, undefined],
        [1, undefined],
        [2, undefined],
        [3, undefined],
        [4, 2],
        [5, 2],
        [6, 2],
        [7, 2],
    ])('nextAncestorIndex(%i) -> %j', (parentIndex: number, expectation: number | undefined) => {
        let result = patternMachine.nextAncestorIndex(parentIndex);
        expect(result).toEqual(expectation);
    });
    test.each([
        //
        [0, undefined],
        [1, undefined],
        [2, undefined],
        [3, undefined],
        [4, undefined],
        [5, undefined],
        [6, 4],
        [7, 4],
    ])('previousAncestorIndex(%i) -> %j', (parentIndex: number, expectation: number | undefined) => {
        let result = patternMachine.previousAncestorIndex(parentIndex);
        expect(result).toEqual(expectation);
    });
});
