import * as lsp from 'vscode-languageserver';
import { TreeSitter } from '../TreeSitter';
import { TypeEnvironment } from '../TypeEnvironment';
import { TSNode } from '../junk_drawer';
import * as _ALL from './all';
export * from './all';
export const ALL = Object.values(_ALL);
export const LINT_NAMES = ALL.map(lint => lint.lintName);
export type SingularMatchLint = (typeof ALL)[number];
export type LintName = (typeof LINT_NAMES)[number];

export function lintAll(node: TSNode, tree_sitter: TreeSitter, typeEnvironment: TypeEnvironment): lsp.Diagnostic[] {
    let diagnostics: lsp.Diagnostic[] = [];
    let matches = tree_sitter.queries.LINTING.matches(node);
    diagnostics.push(...ALL.flatMap(linter => new linter(typeEnvironment).lintMatches(matches)));
    return diagnostics;
}

export type LintResult = undefined | lsp.Diagnostic | (undefined | lsp.Diagnostic)[];
