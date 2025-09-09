import { ClosingStyle, FormattingStyle } from '../../src/formatting/Style';

describe('ClosingStyle Validation', () => {
    test.each(['Inline'])('✅ %s', (value: string) => {
        expect(ClosingStyle.is(value)).toBeTruthy();
    });
    test.each(['inline'])('✖️ %s', (value: string) => {
        expect(ClosingStyle.is(value)).toBeFalsy();
    });
});

describe('FormattingStyle', () => {
    describe('Validaiton', () => {
        test.each([
            { grouping: { closingStyle: ClosingStyle.InnerIndentation } },
            { grouping: { closingStyle: 'Inner Indentation' } },
            { grouping: { closingStyle: 'inner indentation' } }
        ])('test %i', (object: any) => {
            const style = FormattingStyle.fromObject(object);
            const result = ClosingStyle.is(style.groupings.closingStyle);
            expect(result).toBeTruthy();
        });
    });
});
