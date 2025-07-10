import { Language } from 'web-tree-sitter';
import { Dict } from '../src/Dict';
import { newLanguage } from '../src/junk_drawer';
import { isNotNullish } from '../src/predicates';
import { SMOKE } from '../src/smoke';
import path = require('path');

let language: Language;

export async function initializeLanguage() {
    let languagePath: string = path.resolve(path.join('resources', 'tree-sitter-query.wasm'));
    // let languagePath: string = path.resolve(path.join('..', '..', 'tree-sitter-rust', 'tree-sitter-rust.wasm'));
    language = await newLanguage(languagePath);
    return;
}

test('smoke test', () => {
    expect(SMOKE).toEqual('smoke');
});
describe('scratch', () => {
    beforeAll(() => {
        return initializeLanguage();
    });
    test('scratch', () => {
        let types = language.types;
        let fields = language.fields.filter(isNotNullish);
        // let supertypes = language.supertypes;
        let supertypes = new Dict(
            language.supertypes
                .map(id => [language.nodeTypeForId(id), id])
                .filter((value): value is [string, number] => isNotNullish(value[0]))
        );
        let subtypes = new Dict(
            supertypes.map(([name, id]) => [
                name,
                language
                    .subtypes(id)
                    .map(id => language.nodeTypeForId(id))
                    .filter(isNotNullish),
            ])
        );
        expect(true).toBeTruthy();
    });
});
