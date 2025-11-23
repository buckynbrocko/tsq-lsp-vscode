export type Index = symbol | string | number;

export type Mapping<V> = {
    [index: Index]: V;
};

export class Dict<K extends Index, V> extends Map<K, V> {
    map<R = any>(callbackfn: (value: [K, V], index: number, array: [K, V][]) => R, thisArg?: any): R[] {
        return Array.from(this.entries()).map(callbackfn, thisArg);
    }

    update(key: K, callbackfn: (arg: V | undefined) => V) {
        this.set(key, callbackfn(this.get(key)));
    }

    flatMap<R = any>(callbackfn: (value: V, index: number, array: V[]) => R, thisArg?: any): R[] {
        return [...this.values()].flatMap(callbackfn);
    }

    filterByValue<P extends V = any>(
        predicate: (value: [K, V], index: number, array: [K, V][]) => value is [K, P],
        thisArg?: any
    ): Dict<K, P> {
        return new Dict(Array.from(this.entries()).filter(predicate, thisArg));
    }

    sortedByKey(comparator: (a: K, b: K) => number, thisArg?: any): [K, V][] {
        return this.entriesArray().sort(([a, _], [b, __]) => comparator(a, b));
    }

    forEachValue(callback: (value: V) => void): void {
        for (let value of this.values()) {
            callback(value);
        }
    }

    forEachKey(callbackfn: (key: K) => void) {
        for (let key of this.keys()) {
            callbackfn(key);
        }
    }

    every(predicate: (value: V) => boolean): boolean {
        for (let value of this.values()) {
            if (!predicate(value)) {
                return false;
            }
        }
        return true;
    }

    some(predicate: (value: V) => boolean): boolean {
        for (let value of this.values()) {
            if (predicate(value)) {
                return true;
            }
        }
        return false;
    }

    keysArray(): K[] {
        return [...this.keys()];
    }

    valuesArray(): V[] {
        return Array.from(this.values());
    }

    entriesArray(): [K, V][] {
        return [...this.entries()];
    }

    static fromRecord<V>(record: Mapping<V>): Dict<string, V> {
        let entries: [string, V][] = Object.getOwnPropertyNames(record).map(name => [name, record[name]!]);
        return new Dict(entries);
    }

    static fromObject(object: Object) {
        return new Dict(Object.entries(object));
    }
}
