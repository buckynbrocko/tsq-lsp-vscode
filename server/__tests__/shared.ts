import { readFileSync } from 'fs';
import * as path from 'path';
import { Language, Query } from 'web-tree-sitter';
import { newLanguage } from '../src/junk_drawer';

export async function initializeLanguage(file: string = 'tree-sitter-query.wasm') {
    let languagePath: string = path.resolve(path.join('resources', file));
    return await newLanguage(languagePath);
}

export function readResourceSync(...pathParts: [string, ...string[]]): string {
    let path_: string = path.join('resources', ...pathParts);
    let contents: string = readFileSync(path_, { encoding: 'utf-8' });
    return contents;
}

export function loadQuery(language: Language, name: string): Query {
    name = name.endsWith('.scm') ? name : name + '.scm';
    const contents: string = readResourceSync('queries', name);
    const query: Query = new Query(language, contents);
    return query;
}
