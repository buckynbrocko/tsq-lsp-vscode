import { readFileSync } from 'fs';
import { CaptureQuantifier, Language, Query, QueryPredicate, QueryProperties } from 'web-tree-sitter';

export type QueryLike = Query | UninitializedQuery;

export type Returns<T> = (..._: any[]) => T | ((_: any) => T) | (() => T);

export namespace Return {
    export const Void: Returns<void> = (..._: any[]) => {};
    export const Null: Returns<null> = (..._: any[]) => null;
    export const Array: Returns<[]> = (..._: any[]) => [];
    export const True: Returns<true> = (..._: any[]) => true;
    export const False: Returns<false> = (..._: any[]) => false;
    export const Zero: Returns<0> = (..._: any[]) => 0;
}

const RETURN_LIST: Returns<[]> = (..._: any[]) => [];
const VOID: Returns<void> = (..._: any[]) => {};
const RETURN_FALSE: Returns<false> = (..._: any[]) => false;
const RETURN_TRUE: Returns<true> = (..._: any[]) => true;
const RETURN_ZERO: Returns<0> = (..._: any[]) => 0;

export class UninitializedQuery {
    constructor(public source: string) {}
    readonly captureNames: string[] = [];
    readonly captureQuantifiers: CaptureQuantifier[][] = [];
    readonly predicates: QueryPredicate[][] = [];
    readonly setProperties: QueryProperties[] = [];
    readonly assertedProperties: QueryProperties[] = [];
    readonly refutedProperties: QueryProperties[] = [];
    matchLimit = undefined;
    static is(query: QueryLike): query is UninitializedQuery {
        return query instanceof UninitializedQuery;
    }

    initialize(language: Language, queriesPath?: string) {
        if (!!queriesPath) {
            let path_: string | undefined;
            try {
                const content = readFileSync(queriesPath, { encoding: 'utf-8' });
                const query = new Query(language, content);
                console.debug(`Successfully loaded query at '${queriesPath}'`);
                return query;
            } catch (e) {
                console.error(`Failed to load contents for query @ '${path_}'`);
                console.error(e);
                return new Query(language, '');
            }
        }
        return new Query(language, this.source);
    }

    delete(): void {}

    matches = Return.Array as Query['matches'];
    captures = RETURN_LIST as Query['captures'];
    predicatesForPattern = RETURN_LIST as Query['predicatesForPattern'];

    disableCapture = VOID as Query['disableCapture'];
    disablePattern = VOID as Query['disablePattern'];

    didExceedMatchLimit = RETURN_FALSE as Query['didExceedMatchLimit'];

    startIndexForPattern = RETURN_ZERO as Query['startIndexForPattern'];
    endIndexForPattern = RETURN_ZERO as Query['endIndexForPattern'];
    patternCount = RETURN_ZERO as Query['patternCount'];
    captureIndexForName = RETURN_ZERO as Query['captureIndexForName'];

    isPatternRooted = RETURN_FALSE as Query['isPatternRooted'];
    isPatternNonLocal = RETURN_FALSE as Query['isPatternNonLocal'];
    isPatternGuaranteedAtStep = RETURN_FALSE as Query['isPatternGuaranteedAtStep'];
}
