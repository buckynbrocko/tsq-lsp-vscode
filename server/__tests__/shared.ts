import { readFileSync } from 'fs';
import * as path from 'path';
import { Language, Parser, Query } from 'web-tree-sitter';
import { newLanguage } from '../src/junk_drawer';

export async function initializeLanguage(file: string = 'tree-sitter-query.wasm') {
    let languagePath: string = path.resolve(path.join('resources', file));
    return await newLanguage(languagePath);
}


export function readTestingResource(...pathParts: [string, ...string[]]): string {
    return readPathSync('server', '__tests__', 'resources', ...pathParts);
}

export function readPathSync(...pathParts: [string, ...string[]]): string {
    let path_: string = path.join(...pathParts);
    let contents: string = readFileSync(path_, { encoding: 'utf-8' });
    return contents;
}

export function readResourceSync(...pathParts: [string, ...string[]]): string {
    return readPathSync('resources', ...pathParts);
    // let contents: string = readFileSync(path_, { encoding: 'utf-8' });
    // return contents;
}

export function loadQuery(language: Language, name: string): Query {
    name = name.endsWith('.scm') ? name : name + '.scm';
    let pathParts = ['queries', name];
    if (language.name) {
        pathParts.unshift(language.name);
    }
    const contents: string = readResourceSync(...(pathParts as [string, ...string[]]));
    const query: Query = new Query(language, contents);
    return query;
}
