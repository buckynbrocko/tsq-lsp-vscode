import { Capture } from '../../src/formatting/Formattable/Capture';
import { FormattingStyle } from '../../src/formatting/Style';
import { Dummy } from '../../src/junk_drawer';

describe('FormatJob', () => {
    test('Capture', () => {
        let job = Capture.attemptNew(Dummy.Match(), FormattingStyle.default());
        expect(job).toBeUndefined();
    });
    test('Capture', () => {
        let job = Capture.attemptNew(Dummy.Match({ captures: [Dummy.Capture({ name: 'not-capture' })] }), FormattingStyle.default());
        expect(job).toBeUndefined();
    });
    test('Capture', () => {
        let job = Capture.attemptNew(Dummy.Match({ captures: [Dummy.Capture({ name: 'capture' })] }), FormattingStyle.default());
        expect(job).toBeDefined();
    });
});
