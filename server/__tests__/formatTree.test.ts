import path = require('path');
import { Language, Parser } from 'web-tree-sitter';
import { _formatTree, newLanguage } from '../src/junk_drawer';

let language: Language;

async function initializeLanguage() {
    let languagePath: string = path.resolve(path.join('resources', 'tree-sitter-query.wasm'));
    language = await newLanguage(languagePath);
    return;
}
const INJECTIONS = `
((macro_invocation
  (token_tree) @injection.content)
 (#set! injection.language "rust")
 (#set! injection.include-children))

((macro_rule
  (token_tree) @injection.content)
 (#set! injection.language "rust")
 (#set! injection.include-children))
`;

describe('formatTree', () => {
    beforeAll(() => {
        return initializeLanguage();
    });
    test('formatTree', () => {
        let parser = new Parser();
        parser.setLanguage(language);
        let tree = parser.parse(INJECTIONS);
        if (!tree) {
            fail('tree was null');
        }
        let formatted = _formatTree(tree);
        // console.debug(formatted);
        expect(formatted.length).toBeGreaterThan(0);
    });
});
