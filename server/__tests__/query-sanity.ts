import { readFileSync } from "fs";
import { Language, Parser, Query } from "web-tree-sitter";

test.skip('BASENAME', () => {
    return Parser.init()
        .then(() => {
            return Language.load('resources/tree-sitter-query.wasm');
        })
        .then(language => {
            let parser = new Parser();
            parser.setLanguage(language);
            const queryContents = readFileSync('QUERY_PATH', { encoding: 'utf-8' });
            const query = new Query(language, queryContents);
            return query;
        })
        .then(query => {
            expect(query).toBeTruthy();
        });
});