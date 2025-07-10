import { Predicate } from './predicates';

export function split<T>(items: T[], predicate: Predicate<T>): [T[], T[]] {
    let a: T[] = [];
    let b: T[] = [];
    for (let item of items) {
        (predicate(item) && !!a.push(item)) || b.push(item);
    }
    return [a, b];
}
export function firstOf<T>(array: T[]): T | undefined {
    return array.at(0);
}

export function lastOf<T>(array: T[]): T | undefined {
    return array.at(array.length - 1);
}
