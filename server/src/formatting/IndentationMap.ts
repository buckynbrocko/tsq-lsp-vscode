import * as wts from 'web-tree-sitter';
import { Dict } from '../Dict';
import { IndexRange } from '../IndexRange';
import { CompareNumbers, iterutil } from '../itertools';
import { isNotNullish } from '../predicates';
import { TSNode } from '../reexports';
import { WTSRange } from '../reexports/WTSRange';
import { Capture } from '../TreeSitter';
import { FormattingStyle } from './Style';

function IndentationRangeFromMatch(match: wts.QueryMatch): WTSRange | undefined {
    const indent = Capture.withName(match.captures, 'indent-after')?.node;
    const dedent = Capture.withName(match.captures, 'dedent-after')?.node;
    if (!indent || !dedent) {
        return;
    }
    return WTSRange.betweenNodes(indent, dedent);
}

export class IndentationMap {
    ranges: Set<wts.Range> = new Set();

    static fromMatches(matches: wts.QueryMatch[]): IndentationMap {
        let ranges: WTSRange[] = matches.map(IndentationRangeFromMatch).filter(isNotNullish);
        return IndentationMap.fromRanges(ranges);
    }

    static fromRanges(ranges: wts.Range[]): IndentationMap {
        let map = new IndentationMap();
        for (let range of ranges) {
            let result = map.addRange(range);
            if (result === false) {
                // console.error(`Failed to add range to IndentationMap: "${WTSRange.present(range)}"`);
            }
        }
        return map;
    }

    willAcceptRange(range: wts.Range): boolean {
        return (
            range.startIndex === range.endIndex ||
            range.startIndex < 0 ||
            range.endIndex < 0 ||
            iterutil(this.ranges).some(dataRange => {
                return IndexRange.Pair.crosses(dataRange, range) || IndexRange.Pair.areEqual(dataRange, range);
            })
        );
    }

    addRange(range: wts.Range): boolean {
        if (this.willAcceptRange(range)) {
            return false;
        }

        this.ranges.add(range);
        return true;
    }

    calculate(index: number, style: FormattingStyle, xdent: number = 0): number {
        return (this.levelAt(index) + xdent) * style.tabSize;
    }

    calculateBefore(node: TSNode, style: FormattingStyle, xdent: number = 0): number {
        return this.calculate(node.startIndex, style, xdent);
    }

    calculateAfter(node: TSNode, style: FormattingStyle, xdent: number = 0): number {
        return this.calculate(node.endIndex, style, xdent);
    }

    levelAt(index: number): number {
        return iterutil(this.ranges).filter(range => IndexRange.ContainsIndex(range, index)).length;
    }

    get boundries(): Set<number> {
        let set = new Set<number>();
        if (!this.ranges.size) {
            return set;
        }
        set.add(0);
        this.ranges.forEach(range => {
            set.add(range.startIndex);
            set.add(range.endIndex);
        });
        return set;
    }

    asFunction(): (index: number) => number {
        const boundries: number[] = [...this.boundries].sort(CompareNumbers);
        const highest: number = Math.max(0, ...boundries);
        const dict: Dict<number, number> = new Dict(boundries.map(i => [i, this.levelAt(i)]));
        const fn: (index: number) => number = (index: number): number => {
            if (index > highest || index < 0) {
                return 0;
            }
            let nearest = nearestPreceding(index, boundries);
            if (nearest !== undefined) {
                return dict.get(nearest) ?? 0;
            }
            return 0;
        };
        return fn;
    }
}

// function nearestPreceding(target: number, values: [number, ...number[]]): number {
function nearestPreceding(target: number, values: number[]): number {
    if (values.includes(target)) {
        return target;
    }
    let values_ = values.sort(CompareNumbers);
    // if (target > lastOf(values)!) {
    //     return 0;
    // }
    let current: number = 0;
    for (let value of values_) {
        if (value > target) {
            return current;
        }
        current = value;
    }
    return current;
}
