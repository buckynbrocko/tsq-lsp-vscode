import { IndexRange } from '../src/IndexRange';

describe('IndexRange', () => {
    test.each([
        [0, 10, 20, 30],
        [0, 10, 0, 20],
        [0, 10, 5, 10],
        [0, 20, 5, 10],
    ])('doNotCross [%p, %p] [%p, %p]', (aStart, aEnd, bStart, bEnd) => {
        let a = IndexRange(aStart, aEnd);
        let b = IndexRange(bStart, bEnd);
        expect(IndexRange.Pair.doesNotCross(a, b)).toBeTruthy();
    });
});
