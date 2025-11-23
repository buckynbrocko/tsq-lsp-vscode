import { isGeneratorFunction, isSet } from 'util/types';
import { castUnchecked, Predicate } from './predicates';

export type PairOf<T> = [T, T];
export type PairsOf<T> = Iterable<PairOf<T>>;

export function split<T>(items: T[], predicate: Predicate<T>): [T[], T[]] {
    let a: T[] = [];
    let b: T[] = [];
    for (let item of items) {
        (predicate(item) && !!a.push(item)) || b.push(item);
    }
    return [a, b];
}
export function firstOf<T>(iterable: Iterable<T>): T | undefined {
    for (let item of iterable) {
        return item;
    }
    return;
}

export function lastOf<T>(array: T[]): T | undefined {
    return array.at(array.length - 1);
}

export function enumNames<E extends {}>(enum_: E) {
    return Object.keys(enum_)
        .filter(m => Number.isNaN(Number(m)))
        .map(castUnchecked<keyof E>);
}

export function CompareNumbers(a: number, b: number): number {
    return a - b;
}

export function terracedCompare(a: [number, ...number[]], b: [number, ...number[]]): number {
    let result = 0;
    let a_: number | undefined = a.shift();
    let b_: number | undefined = b.shift();
    while (result === 0 && (a_ !== undefined || b_ !== undefined)) {
        if (a_ === undefined) {
            return -1;
        }
        if (b_ === undefined) {
            return 1;
        }
        result = a_ - b_;
        a_ = a.shift();
        b_ = b.shift();
    }
    return result;
}

export function iteratorFrom<T>(iterable: Iterable<T>): Iterator<T> {
    return iterable[Symbol.iterator]();
}

export function* numberRange(end: number, start = 0, inclusive: boolean = false) {
    if (start === end) {
        yield start;
        return;
    }
    const increment: 1 | -1 = start < end ? 1 : -1;
    end = inclusive ? end + increment : end;
    let current = start;
    while (increment === 1 ? current < end : current > end) {
        yield current;
        current += increment;
    }
    return;
}

const _PAIRWISE_SENTINEL = Symbol('_PAIRWISE_SENTINEL');
type _PairwiseSentinel = typeof _PAIRWISE_SENTINEL;
const PAIRWISE_MAX_ITERATIONS: number = 2 ^ (16 as const);

export function* pairwise<T>(iterable: Iterable<T>): Iterator<[T, T]> {
    let iterator = iteratorFrom(iterable);
    let former: IteratorResult<T> = iterator.next();
    let latter: IteratorResult<T> = iterator.next();
    let count = 0;
    while (count < PAIRWISE_MAX_ITERATIONS && !former.done && !latter.done) {
        yield [former.value, latter.value];
        former = latter;
        latter = iterator.next();
        count += 1;
    }
    return;
}

export function iterutil<T>(iter: Iterable<T> | Iterator<T>): IterUtil<T> {
    return new IterUtil(iter);
}
export class IterUtil<T> {
    MAX_INEFFICIENT_LENGTH: number = 2 ^ (32 as const);
    constructor(private iter: Iterable<T> | Iterator<T> | Generator<T, any, any>) {}
    [Symbol.iterator](): Iterator<T> {
        if (Symbol.iterator in this.iter) {
            return this.iter[Symbol.iterator]();
        }
        if (isGeneratorFunction(this.iter)) {
            return this.iter() as Generator<T>;
        }
        return this.iter;
    }

    get length(): number {
        if (Array.isArray(this.iter)) {
            return this.iter.length;
        }
        if (isSet(this.iter)) {
            return this.iter.size;
        }
        return this._inefficient_length;
    }
    get _inefficient_length(): number {
        let count = 0;
        for (let item of this) {
            if (count === this.MAX_INEFFICIENT_LENGTH) {
                throw 'Too many items in IterUtil';
            }
            count += 1;
        }
        return count;
    }
    some(predicate: (arg: T) => boolean): boolean {
        for (let item of this) {
            if (!!predicate(item)) {
                return true;
            }
        }
        return false;
    }
    every(predicate: (arg: T) => boolean): boolean {
        for (let item of this) {
            if (!predicate(item)) {
                return false;
            }
        }
        return true;
    }
    forEach<R>(fn: (arg: T) => any): void {
        for (let item of this) {
            fn(item);
        }
    }
    filter<P extends Predicate<T>>(predicate: P): IterUtil<T> {
        let iterator = this;
        let generator: () => Generator<T, void, unknown> = function* () {
            for (let item of iterator) {
                if (predicate(item)) {
                    yield item as T;
                }
            }
            return;
        };
        return new IterUtil<T>(generator());
    }

    map<R>(fn: (arg: T) => R): IterUtil<R> {
        let iter = this;

        return new IterUtil(
            (function* () {
                for (let item of iter) {
                    yield fn(item);
                }
            })()
        );
    }

    pairwise(): IterUtil<[T, T]> {
        let iterable = this;
        return new IterUtil(
            (function* (): Generator<[T, T]> {
                let iterator = iteratorFrom(iterable);
                let former: IteratorResult<T> = iterator.next();
                let latter: IteratorResult<T> = iterator.next();
                let count = 0;
                while (count < PAIRWISE_MAX_ITERATIONS && !former.done && !latter.done) {
                    yield [former.value, latter.value];
                    former = latter;
                    latter = iterator.next();
                    count += 1;
                }
                return;
            })()
        );
    }
}
