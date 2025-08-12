export type IndexRange = {
    startIndex: number;
    endIndex: number;
};

export function IndexRange(startIndex: number, endIndex: number): IndexRange {
    return { startIndex, endIndex };
}

export namespace IndexRange {
    export function ContainsIndex(range: IndexRange, index: number): boolean {
        return range.startIndex <= index && index < range.endIndex;
    }

    export type Pair = [IndexRange, IndexRange];
    export namespace Pair {
        export function crosses(a: IndexRange, b: IndexRange): boolean {
            const aLo = Math.min(a.startIndex, a.endIndex);
            const aHi = Math.max(a.startIndex, a.endIndex);
            const bLo = Math.min(b.startIndex, b.endIndex);
            const bHi = Math.max(b.startIndex, b.endIndex);
            return (aLo < bLo && bLo < aHi && aHi < bHi) || (bLo < aLo && aLo < bHi && bHi < aHi);
        }

        export function doesNotCross(a: IndexRange, b: IndexRange): boolean {
            return !crosses(a, b);
        }
        export function areEqual(a: IndexRange, b: IndexRange): boolean {
            return a.startIndex === b.startIndex && a.endIndex === b.endIndex;
        }
    }
}
