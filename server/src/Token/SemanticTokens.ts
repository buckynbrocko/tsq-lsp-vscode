import { Dict } from '../Dict';
import { enumNames, TSNode } from '../junk_drawer';
export { TOKEN_MAP as MAP, TOKEN_MODIFIERS as MODIFIERS, TOKEN_TYPES as TYPES };

export type EncodedTokenData = [number, number, number, number, number];

export type AbsoluteTokenData = {
    line: number;
    startChar: number;
    length: number;
    tokenType: number;
    tokenModifiers: number;
};

export namespace AbsoluteTokenData {
    export function fromNode(node: TSNode, tokenType: TokenType, tokenModifiers: number): AbsoluteTokenData {
        return {
            line: node.startPosition.row,
            startChar: node.startPosition.column,
            length: node.endIndex - node.startIndex,
            tokenType,
            tokenModifiers,
        };
    }

    export function encode(data: AbsoluteTokenData[]): number[] {
        return RelativeTokenData.fromAbsoluteTokenData(data).flatMap(RelativeTokenData.encode);
    }
}

export type TokenDataDelta = {
    deltaLine: number;
    deltaStartChar: number;
};

export namespace TokenDataDelta {
    export function create(previous: AbsoluteTokenData, current: AbsoluteTokenData): TokenDataDelta {
        if (previous.line === current.line) {
            return { deltaLine: 0, deltaStartChar: current.startChar - previous.startChar };
        } else {
            return { deltaLine: current.line - previous.line, deltaStartChar: current.startChar };
        }
    }
}

export type RelativeTokenData = {
    deltaLine: number;
    deltaStartChar: number;
    length: number;
    tokenType: number;
    tokenModifiers: number;
};

export namespace RelativeTokenData {
    export function encode(data: RelativeTokenData): EncodedTokenData {
        return [data.deltaLine, data.deltaStartChar, data.length, data.tokenType, data.tokenModifiers];
    }

    export function fromAbsoluteTokenData(data: AbsoluteTokenData[]): RelativeTokenData[] {
        let relative: RelativeTokenData[] = [];
        if (!data.length) {
            return relative;
        }
        let previous = data.shift()!;
        relative.push({
            deltaLine: previous.line,
            deltaStartChar: previous.startChar,
            length: previous.length,
            tokenType: previous.tokenType,
            tokenModifiers: previous.tokenModifiers,
        });
        for (let current of data) {
            relative.push({
                ...TokenDataDelta.create(previous, current),
                length: current.length,
                tokenType: current.tokenType,
                tokenModifiers: current.tokenModifiers,
            });
            previous = current;
        }
        return relative;
    }
}

export enum TokenType {
    nonDescript,
    decorator,
    comment,
    regexp,
    variable,
    escapeSequence,
    keyword,
}

export enum TokenModifier {
    none = 0,
    defaultLibrary = 1,
    // another = 1 << 2,
    // escapeSequence = 1 << 3,
}

export type TokenTypeName = keyof typeof TokenType;
export type TokenModifierName = Exclude<keyof typeof TokenModifier, 'none'>;

export const TOKEN_TYPES: TokenTypeName[] = enumNames(TokenType);
export const TOKEN_MODIFIERS: TokenModifierName[] = enumNames(TokenModifier).filter(name => name !== 'none');

export type TokenMap = Dict<string, [TokenType, TokenModifier]>;
export function TokenMap(data: [string, TokenType, TokenModifier?][]): TokenMap {
    let entries: [string, [TokenType, TokenModifier]][] = data.map(([name, type, modifier]) => [
        name,
        [type, modifier || TokenModifier.none],
    ]);
    return new Dict(entries);
}

export const TOKEN_MAP: TokenMap = TokenMap([
    ['string.regexp', TokenType.regexp], //
    ['pattern.built-in', TokenType.variable, TokenModifier.defaultLibrary],
    ['capture-name', TokenType.decorator],
    ['string.escape', TokenType.escapeSequence],
    ['hanging-capture', TokenType.keyword],
]);
