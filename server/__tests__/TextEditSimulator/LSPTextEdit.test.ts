import { PairsOf } from '../../src/itertools';
import { Quadruplet } from '../../src/junk_drawer';
import { LSPRange } from '../../src/reexports/LSPRange';
import { LSPTextEdit } from '../../src/TextEditSimulator';

describe('LSPTextEdit', () => {
    test.each([
        [
            [0, 1, 0, 3],
            [2, 0, 2, 1],
        ],
        [
            [2, 0, 2, 1],
            [2, 1, 2, 2],
        ],
        [
            [0, 1, 0, 3],
            [2, 1, 2, 2],
        ],
    ] satisfies PairsOf<Quadruplet<number>>)(
        '.Pair.interfere(%j %j) -> false',
        (a: Quadruplet<number>, b: Quadruplet<number>) => {
            let a_: LSPTextEdit = { newText: '', range: LSPRange.fromQuadruplet(...a) };
            let b_: LSPTextEdit = { newText: '', range: LSPRange.fromQuadruplet(...b) };
            let interfere = LSPTextEdit.Pair.interfere(a_, b_);
            expect(interfere).toBeFalsy();
        }
    );
    test.each([
        [
            [0, 1, 0, 3],
            [0, 0, 2, 1],
        ],
        [
            [0, 0, 2, 1],
            [0, 1, 0, 3],
        ],
        [
            [2, 0, 2, 1],
            [2, 0, 2, 2],
        ],
        [
            [2, 0, 2, 2],
            [2, 0, 2, 1],
        ],
        [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ],
    ] satisfies PairsOf<Quadruplet<number>>)(
        '.Pair.interfere(%j %j) -> true',
        (a: Quadruplet<number>, b: Quadruplet<number>) => {
            let a_: LSPTextEdit = { newText: '', range: LSPRange.fromQuadruplet(...a) };
            let b_: LSPTextEdit = { newText: '', range: LSPRange.fromQuadruplet(...b) };
            let interfere = LSPTextEdit.Pair.interfere(a_, b_);
            expect(interfere).toBeTruthy();
        }
    );
    // test.each([
    //     [
    //         [0, 1, 0, 3],
    //         [2, 0, 2, 1],
    //         [2, 1, 2, 2],
    //     ],
    //     [
    //         [0, 1, 0, 3],
    //         [2, 0, 2, 1],
    //         [2, 1, 2, 2],
    //     ],
    // ] satisfies Quadruplets<number>[])('Pair.interfere() false %$', (...quads: Quadruplet<number>[]) => {
    //     let ranges = quads.map(quad => LSPRange.fromQuadruplet(...quad));
    //     let pairs = iterutil(ranges).pairwise();
    //     console.log(pairs.length);
    //     let interfere = pairs.some(([left, right]) => LSPRange.Pair.interfere(left, right));
    //     expect(interfere).toBeFalsy();
    // });
    // test.each([
    //     [
    //         [0, 1, 0, 3],
    //         [2, 0, 2, 1],
    //         [2, 0, 2, 2],
    //     ],
    //     [
    //         [0, 1, 0, 3],
    //         [0, 2, 0, 3],
    //         [2, 1, 2, 2],
    //     ],
    //     [
    //         [0, 0, 0, 0],
    //         [0, 0, 0, 0],
    //     ],
    //     [
    //         [0, 0, 0, 0],
    //         [0, 0, 2, 2],
    //         [0, 0, 0, 0],
    //     ],
    // ] satisfies Quadruplets<number>[])('Pair.interfere() true %$', (...quads: Quadruplet<number>[]) => {
    //     let ranges = quads.map(quad => LSPRange.fromQuadruplet(...quad)).sort(LSPRange.comparator);
    //     let pairs = iterutil(ranges).pairwise();
    //     // for (let pair of pairs) {
    //     //     console.log(LSPRange.Pair.present(...pair));
    //     // }
    //     let interfere = pairs.some(([left, right]) => LSPRange.Pair.interfere(left, right));
    //     expect(interfere).toBeTruthy();
    // });
});
