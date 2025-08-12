import { IndexRange } from '../IndexRange';
import { isNotNullish } from '../predicates';
import { WTSRange } from '../reexports/WTSRange';
import { Formattable } from './Formattable/Formattable';
import { IndentationMap } from './IndentationMap';
import { FormattingStyle } from './Style';

export class FormattingContext {
    constructor(public indentations: IndentationMap, public style: FormattingStyle) {}

    static fromFormattables(formattables: Formattable[], options: FormattingStyle): FormattingContext {
        const ranges: WTSRange[] = formattables.map(f => f.indentationRange).filter(isNotNullish);
        const indentations = IndentationMap.fromRanges(ranges);
        return new FormattingContext(indentations, options);
    }

    indentationAt(index: number, xdent: number = 0): number {
        return this.indentations.calculate(index, this.style, xdent);
    }

    indentationBefore(item: IndexRange, xdent: number = 0): number {
        return this.indentationAt(item.startIndex, xdent);
    }

    indentationAfter(item: IndexRange, xdent: number = 0): number {
        return this.indentationAt(item.endIndex, xdent);
    }
}
