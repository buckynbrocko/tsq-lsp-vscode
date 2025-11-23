import { CartesianSpread } from '../src/untitled';

describe('CartesianSpread', () => {
    test.each([
        //
        [[[0]], [[1]], [[0, 1]]],
        [[[0]], [[1, 2]], [[0, 1, 2]]],
        [
            [[0]],
            [[1], [2]],
            [
                [0, 1],
                [0, 2],
            ],
        ],
        [
            [[0, 1, 2]],
            [[3], [4]],
            [
                [0, 1, 2, 3],
                [0, 1, 2, 4],
            ],
        ],
        [
            [[0, 1]],
            [
                [2, 3],
                [4, 5],
            ],
            [
                [0, 1, 2, 3],
                [0, 1, 4, 5],
            ],
        ],
        [
            [
                [0, 1],
                [2, 3],
            ],
            [
                [4, 5],
                [6, 7],
            ],
            [
                [0, 1, 4, 5],
                [0, 1, 6, 7],
                [2, 3, 4, 5],
                [2, 3, 6, 7],
            ],
        ],
    ])('%o, %o', (a: number[][], b: number[][], expectation: number[][]) => {
        let result = CartesianSpread(a, b);
        expect(result).toEqual(expectation);
    });
});
