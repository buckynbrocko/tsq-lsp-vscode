import { TSNode } from './reexports';

export type Predicate<T> = (arg: T) => boolean;
export function isString(object: unknown): object is string {
    return typeof object === 'string';
}

export function isPositiveOrUndefined(object: number | undefined): boolean {
    return object === undefined || object >= 0;
}

export function isBoolean(object: unknown): object is boolean {
    return typeof object === 'boolean';
}

export function hasNonZeroLength<T>(object: T[]): object is [T, ...T[]] {
    return !!object.length;
}

// export function isType<T extends string, Ts extends [T, ...T[]], O extends TSNode>(object: O, ...types: T[]): object is O & { type: (typeof types)[number] };
// export function isType<T extends string, Ts extends [T, ...T[]], O extends TSNode>(object: O, types: T): object is O & { type: typeof types };
export function isType_<T extends string, O extends { type: any }>(
    object: O,
    ...types: [T, ...T[]]
): object is O & { type: (typeof types)[number] } {
    return types.some(type => type === object.type);
}

export type Typed<T = any> = { type: T };

export function isTypeFn<T extends string, O extends { type: any }>(
    ...types: [T, ...T[]]
): (object: O) => object is O & { type: (typeof types)[number] } {
    return (object: O): object is O & { type: (typeof types)[number] } => {
        return types.some(type => type === object.type);
    };
}

export function isType<T extends string>(node: Typed, ...types: [T, ...T[]]): node is typeof node & Typed<T>;
export function isType<T extends string>(...types: [T, ...T[]]): (object: TSNode) => object is typeof object & Typed<T>;
export function isType<T extends string>(...args: [Typed, T, ...T[]] | [T, ...T[]]) {
    const [first, ...rest] = args;
    if (typeof first !== 'object') {
        const types = [first, ...rest];
        return (object: TSNode): object is typeof object & Typed<T> => (types as string[]).includes(object.type);
    }
    const [node, ...types] = [first, ...rest];
    return (types as string[]).includes(node.type);
}

export function isNotType<T extends string>(node: Typed, ...types: [T, ...T[]]): node is typeof node & Typed<Exclude<any, T>>;
export function isNotType<T extends string>(
    ...types: [T, ...T[]]
): (object: TSNode) => object is typeof object & Typed<Exclude<any, T>>;
export function isNotType<T extends string>(...args: [Typed, T, ...T[]] | [T, ...T[]]) {
    const [first, ...rest] = args;
    if (typeof first !== 'object') {
        const types = [first, ...rest];
        return (object: TSNode): object is typeof object & Typed<Exclude<any, T>> => !(types as string[]).includes(object.type);
    }
    const [node, ...types] = [first, ...rest];
    return !(types as string[]).includes(node.type);
}

type PredicateOrPartial<O, T> = (...args: [O, T, ...T[]] | [T, ...T[]]) => {};
type Predicate_<O, I = any> = O extends I ? (arg: I) => arg is O : (arg: any) => arg is O;
type SpreadicateFunction<F, T, R> = (
    ...args: [F, T, ...T[]] | [T, ...T[]]
) => typeof args extends [F, T, ...T[]] ? boolean : (object: F) => object is F & R;
export type HasNextSibling<N extends { nextSibling: any } = TSNode, T extends string = string> = N & {
    nextSibling: NonNullable<N['nextSibling']> & { type: T };
};
export type HasNoNextSibling<T extends { nextSibling: any } = TSNode> = T & { nextSibling: null };

export function hasNextSibling<T extends { nextSibling: any }>(object: T): object is HasNextSibling<T> {
    return !!object.nextSibling;
}

export type HasPreviousSibling<N extends { previousSibling: any } = TSNode, T extends string = string> = N & {
    previousSibling: NonNullable<N['previousSibling']> & { type: T };
};
export type HasNoPreviousSibling<T extends { previousSibling: any } = TSNode> = T & { previousSibling: null };

export function hasPreviousSibling<T extends { previousSibling: any }>(object: T): object is HasPreviousSibling<T> {
    return !!object.previousSibling;
}

export function nextSiblingIsType<T extends string>(
    node: HasNoNextSibling,
    ...types: [T, ...T[]]
): node is HasNextSibling<typeof node, T> & never;
export function nextSiblingIsType<T extends string>(
    node: HasNextSibling,
    ...types: [T, ...T[]]
): node is HasNextSibling<typeof node, T>;
export function nextSiblingIsType<T extends string>(
    node: TSNode,
    ...types: [T, ...T[]]
): node is HasNextSibling<typeof node> & HasNextSibling<typeof node, T>;
export function nextSiblingIsType<T extends string>(
    ...types: [T, ...T[]]
): (object: TSNode) => object is HasNextSibling<typeof object> & HasNextSibling<typeof object, T>;
export function nextSiblingIsType<T extends string>(...args: [TSNode, T, ...T[]] | [T, ...T[]]) {
    const [first, ...rest] = args;
    if (typeof first !== 'object') {
        const types = [first, ...rest];
        return (object: TSNode): object is HasNextSibling<typeof object> & HasNextSibling<typeof object, T> =>
            !!object.nextSibling && (types as string[]).includes(object.nextSibling.type);
    }
    const [node, ...types] = [first, ...rest];
    return !!node.nextSibling && (types as string[]).includes(node.nextSibling.type);
}

export function nextSiblingIsNotType<T extends string>(node: HasNextSibling<TSNode>, ...types: [T, ...T[]]): boolean;
export function nextSiblingIsNotType<T extends string>(
    ...types: [T, ...T[]]
): (object: TSNode & { nextSibling: TSNode }) => boolean;
export function nextSiblingIsNotType<T extends string>(...args: [HasNextSibling<TSNode>, T, ...T[]] | [T, ...T[]]) {
    const [first, ...rest] = args;
    if (typeof first !== 'object') {
        const types = [first, ...rest];
        return (object: HasNextSibling<TSNode>) => !(types as string[]).includes(object.nextSibling.type);
    }
    const [node, ...types] = [first, ...rest];
    return !(types as string[]).includes(node.nextSibling.type);
}

export function isNotTypeFn<T extends string>(...types: [T, ...T[]]): (object: { type: any }) => boolean {
    return (object: { type: any }) => !types.includes(object.type);
}

export function everyValueOfSet<T>(set: Set<T>, predicate: Predicate<T>) {
    for (let value of set.values()) {
        if (!predicate(value)) {
            return false;
        }
    }
    return true;
}
export function isNotNullish<T>(arg: T): arg is NonNullable<T> {
    return arg !== undefined && arg !== null;
}
export function isArray(object: any): object is object extends Array<infer T> ? T[] : any[] {
    return Array.isArray(object);
}

export function isArrayOf<T>(object: any, predicate: TypePredicate<T>): object is T[];
export function isArrayOf<T>(object: TypePredicate<T>): TypePredicate<T[]>;
export function isArrayOf<T>(
    object: any | TypePredicate<T>,
    predicate?: TypePredicate<T> | undefined
): TypeAssertion<T[]> | TypePredicate<T[]> {
    if (predicate === undefined) {
        return createIsArrayOfFunction(object);
    }
    return isArray(object) && object.every(predicate);
}
function createIsArrayOfFunction<T>(predicate: TypePredicate<T>): TypePredicate<T[]> {
    return (object: any): object is T[] => isArrayOf(object, predicate);
}
export function isEmptyObject(object: any): object is EmptyObject {
    return Object.keys(object).length === 0;
}

export function isNotEmpty(object: unknown): object is Exclude<typeof object, EmptyObject> {
    return !isEmptyObject(object);
}

export function lacksProperty<P extends PropertyKey>(
    object: any,
    name: P
): object is typeof object & {
    [key in P]: never;
} {
    return object === null || (typeof object === 'object' && !object.hasOwnProperty(name));
}

export function lacksOrHasPropertyOfType<P extends string | number, PT>(
    object: any,
    name: P,
    predicate: TypePredicate<PT>
): object is typeof object & HasPropertyOfType<P, PT> {
    return object === null || typeof object === 'object' || !object.hasOwnProperty(name) || predicate(object[name]);
}

export function hasProperty<P extends PropertyKey, T>(
    object: any,
    name: P,
    predicate?: TypePredicate<T>
): object is typeof object & typeof predicate extends undefined ? HasProperty<typeof name> : HasPropertyOfType<typeof name, T> {
    return object !== null && typeof object === 'object' && object.hasOwnProperty(name);
}

export function isRecordOf<T>(
    object: any,
    predicate: TypePredicate<T>
): object is typeof object & Record<keyof typeof object, T> {
    return typeof object === 'object' && Object.values(object).every(predicate);
}

export function castUnchecked<T>(arg: any): T {
    return arg;
}

export function hasPropertyOfType<P extends string | number, PT>(
    object: any,
    name: P,
    predicate: TypePredicate<PT>
): object is typeof object & HasPropertyOfType<P, PT> {
    return hasProperty(object, name) && predicate(object[name]);
}

export type _PropertyPredicateRecord = {
    [name: PropertyKey]: TypeNarrower;
};
type PropertyPredicateRecord<T> = {
    [Key in keyof T]: (object: unknown) => object is T[Key];
};

export type PropertiesPredicateType<T> = T extends PropertyPredicateRecord<infer K> ? K : never;

export function hasPropertiesOfTypes<T>(
    object: any,
    pairs: PropertyPredicateRecord<T>
): object is PropertiesPredicateType<typeof pairs> {
    if (object === null || typeof object !== 'object') {
        return false;
    }
    let entries: [string, TypeNarrower][] = Object.entries(pairs);
    let result = entries.every(([name, predicate]) => Object.keys(object).includes(name) && predicate(object[name]));
    return result;
}
function hpot_test(object: any) {
    if (hasPropertiesOfTypes(object, { bar: isString, baz: isBoolean })) {
        object.bar.slice;
        object.baz;
    }
}
export type TypePredicate<T> = TypeNarrower<T> | TypeWidener<T>;
export type TypeNarrower<T = unknown> = (object: unknown) => object is T;
export type TypeWidener<T> = (object: unknown) => object is typeof object & T;

export type TypeAssertion<T> = ReturnType<TypePredicate<T>>;
// export type HasPropertyOfType<P extends PropertyKey, T> = Record<P, T>;
export type HasProperty<P extends PropertyKey> = {
    [Key in P]: unknown;
};
export type HasPropertyOfType<P extends PropertyKey, T> = {
    [Key in P]: T;
};
type NonZeroNumber = Exclude<number, 0>;
type NonZero<N = number> = N extends 0 ? never : N;
type UnpopulatedArray<T = any> = T[] & { length: 0 } & [];
type ArrayWithLength<T = any, L = NonZeroNumber> = T[] & { length: L };
const EMPTY_ARRAY = [] as const;
export type EmptyArray = typeof EMPTY_ARRAY;
export const EMPTY = {} as const;
export type EmptyObject = typeof EMPTY;
