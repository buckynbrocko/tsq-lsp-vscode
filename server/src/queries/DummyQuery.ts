import { readFileSync } from 'fs';
import { CaptureQuantifier, Language, Query, QueryPredicate, QueryProperties } from 'web-tree-sitter';

export type QueryLike = Query | UninitializedQuery;

type Returns<T> = (..._: any[]) => T;

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

    matches: Query['matches'] = RETURN_LIST;
    captures: Query['captures'] = RETURN_LIST;
    predicatesForPattern: Query['predicatesForPattern'] = RETURN_LIST;

    disableCapture: Query['disableCapture'] = VOID;
    disablePattern: Query['disablePattern'] = VOID;

    didExceedMatchLimit: Query['didExceedMatchLimit'] = RETURN_FALSE;

    startIndexForPattern: Query['startIndexForPattern'] = RETURN_ZERO;
    endIndexForPattern: Query['endIndexForPattern'] = RETURN_ZERO;
    patternCount: Query['patternCount'] = RETURN_ZERO;
    captureIndexForName: Query['captureIndexForName'] = RETURN_ZERO;

    isPatternRooted: Query['isPatternRooted'] = RETURN_FALSE;
    isPatternNonLocal: Query['isPatternNonLocal'] = RETURN_FALSE;
    isPatternGuaranteedAtStep: Query['isPatternGuaranteedAtStep'] = RETURN_FALSE;
}
