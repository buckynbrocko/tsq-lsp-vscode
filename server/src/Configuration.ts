import { FormattingStyle, StylePartial } from './formatting/Style';

class Configuration {
    constructor(public formattingStyle: FormattingStyle) {}

    static attempt(formattingStyle: StylePartial): Configuration | undefined {
        const _style = FormattingStyle.fromPartial(formattingStyle);
        return new Configuration(_style);
    }
}

let example = {
    formattingStyle: {
        
    }
}