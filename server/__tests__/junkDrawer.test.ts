import { PairsOf } from '../src/itertools';
import { Quadruplet } from '../src/junk_drawer';
import { LSPRange } from '../src/reexports/LSPRange';

[[34, 6, 37]];

describe('LSPRange', () => {
    test.each([
        //
        [-1, [0, 0, 1, 1], [2, 2, 3, 3]],
        [-1, [0, 0, 1, 1], [0, 0, 1, 2]],
        [1, [2, 2, 3, 3], [0, 0, 1, 1]],
        [0, [0, 0, 1, 1], [0, 0, 1, 1]],
        [0, [1, 1, 0, 0], [0, 0, 1, 1]],
        [0, [0, 0, 1, 1], [1, 1, 0, 0]],
        [0, [1, 1, 0, 0], [1, 1, 0, 0]],
        [1, [0, 0, 1, 2], [0, 0, 1, 1]],
        [1, [0, 1, 1, 1], [0, 0, 1, 1]],
    ] satisfies [-1 | 0 | 1, Quadruplet<number>, Quadruplet<number>][])(
        'comparator %i, %j, %j',
        (expectation: -1 | 0 | 1, a: Quadruplet<number>, b: Quadruplet<number>) => {
            const a_ = LSPRange.fromQuadruplet(...a);
            const b_ = LSPRange.fromQuadruplet(...b);
            const result = LSPRange.comparator(a_, b_);
            switch (expectation) {
                case -1:
                    expect(result).toBeLessThan(0);
                    break;
                case 0:
                    expect(result).toEqual(0);
                    break;
                case 1:
                    expect(result).toBeGreaterThan(0);
                    break;
                default:
                    fail(expectation);
            }
        }
    );

    test.each([
        //
        [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ],
        [
            [0, 0, 2, 2],
            [1, 1, 3, 3],
        ],
        [
            [0, 0, 2, 2],
            [0, 0, 3, 3],
        ],
        [
            [0, 0, 1, 1],
            [0, 0, 1, 1],
        ],
        [
            [1, 1, 3, 3],
            [0, 0, 2, 2],
        ],
        [
            [1, 1, 2, 2],
            [0, 0, 3, 3],
        ],
        [
            [1, 1, 3, 3],
            [2, 2, 4, 4],
        ],
        [
            [0, 0, 3, 3],
            [1, 1, 2, 2],
        ],
        [
            [1, 1, 2, 2],
            [0, 0, 3, 3],
        ],
    ] satisfies PairsOf<Quadruplet<number>>)('`intersect` %j, %j', (a: Quadruplet<number>, b: Quadruplet<number>) => {
        const a_ = LSPRange.fromQuadruplet(...a);
        const b_ = LSPRange.fromQuadruplet(...b);
        const result = LSPRange.Pair.interfere(a_, b_);
        expect(result).toBeTruthy();
    });

    test.each([
        //
        [
            [0, 0, 1, 1],
            [2, 2, 3, 3],
        ],
        [
            [2, 2, 3, 3],
            [0, 0, 1, 1],
        ],
        [
            [0, 0, 1, 1],
            [1, 1, 2, 2],
        ],
        [
            [1, 1, 2, 2],
            [0, 0, 1, 1],
        ],
    ] satisfies PairsOf<Quadruplet<number>>)('!`intersect` %j, %j', (a: Quadruplet<number>, b: Quadruplet<number>) => {
        const a_ = LSPRange.fromQuadruplet(...a);
        const b_ = LSPRange.fromQuadruplet(...b);
        const result = LSPRange.Pair.interfere(a_, b_);
        expect(result).toBeFalsy();
    });
});
