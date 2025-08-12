import { IndentationMap } from '../src/formatting/IndentationMap';
import { numberRange, PairOf, PairsOf } from '../src/itertools';
import { WTSRange } from '../src/reexports/WTSRange';

describe('IndentationMap', () => {
    const NOMINAL_VALUES: PairOf<number>[] = [
        [0, 10],
        [0, 20],
        [5, 10],
    ];
    const NOMINAL_RANGES: WTSRange[] = NOMINAL_VALUES.map(pair => WTSRange.mock(...pair));
    const NOMINAL_MAP = IndentationMap.fromRanges(NOMINAL_RANGES);
    test('generic ...', () => {
        let data: PairOf<number>[] = [
            [0, 10],
            [0, 20],
            [5, 10],
        ];
        let ranges: WTSRange[] = data.map(r => WTSRange.mock(...r));
        let indentation = IndentationMap.fromRanges(ranges);
        expect(indentation.ranges.size).toEqual(ranges.length);
        expect(indentation.levelAt(0)).toEqual(2);
        expect(indentation.levelAt(4)).toEqual(2);
        expect(indentation.levelAt(5)).toEqual(3);
        expect(indentation.levelAt(9)).toEqual(3);
        expect(indentation.levelAt(10)).toEqual(1);
        expect(indentation.levelAt(11)).toEqual(1);
        expect(indentation.levelAt(19)).toEqual(1);
        expect(indentation.levelAt(20)).toEqual(0);
    });

    test.each([
        [
            [0, 10],
            [0, 20],
            [5, 10],
        ],
        [
            [0, 10],
            [0, 20],
            [5, 10],
            [5, 9],
            [6, 9],
        ],
    ] as PairOf<number>[][])('No overlap %$', (...pairs: [number, number][]) => {
        let ranges = pairs.map((p, _, __) => WTSRange.mock(...p));
        let indentations = new IndentationMap();
        for (let range of ranges) {
            expect(indentations.addRange(range)).toBeTruthy();
        }
    });

    test.each([
        [1, 11],
        [1, 21],
        [1, 6],
        [4, 6],
        [9, 11],
        [9, 21],
        [4, 21],
        [6, 21],
        [11, 21],
        [19, 21],
    ] satisfies PairsOf<number>)('[%i, %i] overlaps NOMINAL', (s, e) => {
        let indentations = IndentationMap.fromRanges(NOMINAL_RANGES);
        const range = WTSRange.mock(s, e);
        expect(indentations.addRange(range)).toBeFalsy();
    });

    test.each([...numberRange(22)])('asFunction parity %i', (index: number) => {
        let fromMap = NOMINAL_MAP.levelAt(index);
        let fromFunc = NOMINAL_MAP.asFunction()(index);
        expect(fromMap).toEqual(fromFunc);
    });
});
