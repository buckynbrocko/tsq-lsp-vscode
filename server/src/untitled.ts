import { Rule } from './Rule';
import { RuleJSON } from './RuleJSON';


export type RuleContext = { stack: Rule[] };
export namespace RuleContext {
    export function popAndCopy(context: RuleContext): [Rule | undefined, RuleContext];
    export function popAndCopy(context: undefined): [undefined, undefined];
    export function popAndCopy(context?: RuleContext): [undefined, undefined] | [Rule | undefined, RuleContext];
    export function popAndCopy(context?: RuleContext): [undefined, undefined] | [Rule | undefined, RuleContext] {
        if (!context) {
            return [undefined, undefined];
        }
        let rule: Rule | undefined = context?.stack.at(-1);
        let copy: RuleContext = { ...context, stack: context.stack.slice(0, -1) };
        return [rule, copy];
    }

    export function push(rule: Rule, context?: RuleContext): RuleContext {
        return { ...(context ?? {}), stack: [...(context?.stack ?? []), rule] };
    }
}

export function CartesianSpread<T>(a: T[][], b: T[][]): T[][] {
    if (!a.length && !b.length) {
        return [];
    } else if (!a.length) {
        return b;
    } else if (!b.length) {
        return a;
    }
    return a.flatMap(a_ => b.map(b_ => [...a_, ...b_]));
}

export type ResolvedRule =
    | RuleJSON.Blank
    | RuleJSON.String
    | RuleJSON.Pattern
    | RuleJSON.Sequence
    | RuleJSON.Choice
    | RuleJSON.Field
    | RuleJSON.Repeat
    | RuleJSON.Repeat1;

const _SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Tree-sitter grammar specification',
    type: 'object',
    required: ['name', 'rules'],
    additionalProperties: false,
    properties: {
        $schema: {
            type: 'string',
        },
        name: {
            description: 'The name of the grammar',
            type: 'string',
            pattern: '^[a-zA-Z_]\\w*',
        },
        inherits: {
            description: 'The name of the parent grammar',
            type: 'string',
            pattern: '^[a-zA-Z_]\\w*',
        },
        rules: {
            type: 'object',
            patternProperties: {
                '^[a-zA-Z_]\\w*$': {
                    $ref: '#/definitions/rule',
                },
            },
            additionalProperties: false,
        },
        extras: {
            type: 'array',
            uniqueItems: true,
            items: {
                $ref: '#/definitions/rule',
            },
        },
        precedences: {
            type: 'array',
            uniqueItems: true,
            items: {
                type: 'array',
                uniqueItems: true,
                items: {
                    oneOf: [
                        {
                            type: 'string',
                        },
                        {
                            $ref: '#/definitions/symbol-rule',
                        },
                    ],
                },
            },
        },
        reserved: {
            type: 'object',
            patternProperties: {
                '^[a-zA-Z_]\\w*$': {
                    type: 'array',
                    uniqueItems: true,
                    items: {
                        $ref: '#/definitions/rule',
                    },
                },
            },
            additionalProperties: false,
        },
        externals: {
            type: 'array',
            uniqueItems: true,
            items: {
                $ref: '#/definitions/rule',
            },
        },
        inline: {
            type: 'array',
            uniqueItems: true,
            items: {
                type: 'string',
                pattern: '^[a-zA-Z_]\\w*$',
            },
        },
        conflicts: {
            type: 'array',
            uniqueItems: true,
            items: {
                type: 'array',
                uniqueItems: true,
                items: {
                    type: 'string',
                    pattern: '^[a-zA-Z_]\\w*$',
                },
            },
        },
        word: {
            type: 'string',
            pattern: '^[a-zA-Z_]\\w*',
        },
        supertypes: {
            description:
                'A list of hidden rule names that should be considered supertypes in the generated node types file. See https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.',
            type: 'array',
            uniqueItems: true,
            items: {
                description: 'The name of a rule in `rules` or `extras`',
                type: 'string',
            },
        },
    },
    definitions: {
        'blank-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'BLANK',
                },
            },
            required: ['type'],
        },
        'string-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'STRING',
                },
                value: {
                    type: 'string',
                },
            },
            required: ['type', 'value'],
        },
        'pattern-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'PATTERN',
                },
                value: {
                    type: 'string',
                },
                flags: {
                    type: 'string',
                },
            },
            required: ['type', 'value'],
        },
        'symbol-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'SYMBOL',
                },
                name: {
                    type: 'string',
                },
            },
            required: ['type', 'name'],
        },
        'seq-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'SEQ',
                },
                members: {
                    type: 'array',
                    items: {
                        $ref: '#/definitions/rule',
                    },
                },
            },
            required: ['type', 'members'],
        },
        'choice-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'CHOICE',
                },
                members: {
                    type: 'array',
                    items: {
                        $ref: '#/definitions/rule',
                    },
                },
            },
            required: ['type', 'members'],
        },
        'alias-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'ALIAS',
                },
                value: {
                    type: 'string',
                },
                named: {
                    type: 'boolean',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'named', 'content', 'value'],
        },
        'repeat-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'REPEAT',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content'],
        },
        'repeat1-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'REPEAT1',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content'],
        },
        'reserved-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'RESERVED',
                },
                context_name: {
                    type: 'string',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'context_name', 'content'],
        },
        'token-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['TOKEN', 'IMMEDIATE_TOKEN'],
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content'],
        },
        'field-rule': {
            properties: {
                name: {
                    type: 'string',
                },
                type: {
                    type: 'string',
                    const: 'FIELD',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['name', 'type', 'content'],
        },
        'prec-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['PREC', 'PREC_LEFT', 'PREC_RIGHT', 'PREC_DYNAMIC'],
                },
                value: {
                    oneof: [
                        {
                            type: 'integer',
                        },
                        {
                            type: 'string',
                        },
                    ],
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content', 'value'],
        },
        rule: {
            oneOf: [
                {
                    $ref: '#/definitions/alias-rule',
                },
                {
                    $ref: '#/definitions/blank-rule',
                },
                {
                    $ref: '#/definitions/string-rule',
                },
                {
                    $ref: '#/definitions/pattern-rule',
                },
                {
                    $ref: '#/definitions/symbol-rule',
                },
                {
                    $ref: '#/definitions/seq-rule',
                },
                {
                    $ref: '#/definitions/choice-rule',
                },
                {
                    $ref: '#/definitions/repeat1-rule',
                },
                {
                    $ref: '#/definitions/repeat-rule',
                },
                {
                    $ref: '#/definitions/reserved-rule',
                },
                {
                    $ref: '#/definitions/token-rule',
                },
                {
                    $ref: '#/definitions/field-rule',
                },
                {
                    $ref: '#/definitions/prec-rule',
                },
            ],
        },
    },
};
