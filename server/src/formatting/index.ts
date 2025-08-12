import { QueryMatch } from 'web-tree-sitter';
import { LSPTextEdit } from '../TextEditSimulator';
import { FormattingContext } from './Context';
import { Edit } from './Edit';
import * as Formattables from './Formattable';
import { Formattable } from './Formattable';
import { FormattingStyle } from './Style';

export function formatMatches(matches: QueryMatch[], style: FormattingStyle): LSPTextEdit[] {
    const formattables: Formattable[] = Formattables.fromMatches(matches, style);
    const context: FormattingContext = FormattingContext.fromFormattables(formattables, style);
    // const edits: LSPTextEdit[] = formattables.flatMap(f => f.edits(context));
    const contextualizedEdits: Edit[] = formattables.flatMap(f => f.edits(context));
    const edits: LSPTextEdit[] = contextualizedEdits.map(edit => edit.toTextEdit());
    return edits;
}
