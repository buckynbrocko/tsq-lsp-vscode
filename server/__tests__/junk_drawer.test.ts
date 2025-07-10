import { Literal } from '../src/typeChecking';

test.each([['"foo"', 'foo']])('uhhh', (input, expectation) => {
    expect(Literal.dequote(input)).toEqual(expectation);
});
