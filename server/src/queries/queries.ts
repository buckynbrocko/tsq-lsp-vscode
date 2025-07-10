import { QueryLike, UninitializedQuery } from './DummyQuery';
import * as query_strings from './query_strings';

type QueryStrings = typeof query_strings;
type MappedQueries<T> = {
    -readonly [Property in keyof T]: QueryLike;
};
const mapped = Object.entries(query_strings).map(entry => {
    return [entry[0], new UninitializedQuery(entry[1] as string) as QueryLike];
});

export type Queries = MappedQueries<QueryStrings>;

export let queries: Queries = Object.fromEntries(mapped.filter(entry => !!entry[0] && !!entry[1]));
