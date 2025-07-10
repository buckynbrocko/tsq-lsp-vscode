import * as lsp from 'vscode-languageserver';
import { QueryCapture, QueryMatch } from 'web-tree-sitter';
import { LintResult } from '.';
import { isNotNullish } from '../predicates';
import { TypeEnvironment } from '../TypeEnvironment';

export interface SingularMatchLintInterface extends SingularMatchLint {}

export abstract class SingularMatchLint {
    static lintName: string;

    get class() {
        return Object.getPrototypeOf(this).constructor;
    }

    constructor(public typeEnvironment: TypeEnvironment) {}
    static subclasses: SingularMatchLintInterface[] = [];
    static registerSubclass(subclass: SingularMatchLintInterface) {
        SingularMatchLint.subclasses.push(subclass);
    }

    abstract lintMatch(match: QueryMatch): LintResult;

    filterMatch(match: QueryMatch): boolean {
        return this.class.lintName === undefined || match.captures[0]?.name === this.class.lintName;
    }

    filterCapture(capture: QueryCapture) {
        return capture.name === this.class.lintName;
    }

    lintMatches(matches: QueryMatch[]): lsp.Diagnostic[] {
        return matches //
            .filter(this.filterMatch, this)
            .flatMap(this.lintMatch, this)
            .filter(isNotNullish);
    }

    lintMatchesWithoutFiltering(matches: QueryMatch[]): lsp.Diagnostic[] {
        return matches.flatMap(this.lintMatch, this).filter(isNotNullish);
    }
}
