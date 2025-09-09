import * as lsp from 'vscode-languageserver';
import { hasProperty, hasPropertyOfType, isBoolean, isNumber, isObject, isPositiveOrUndefined } from '../predicates';
import { TSNode } from '../reexports';

// NOTE: No idea what the differences between forms are - research?
const NORMALIZATION_FORM = 'NFC';

export enum ClosingStyle {
    Inline = 'Inline',
    InnerIndentation = 'Inner Indentation',
    OuterIndentation = 'Outer Indentation',
}

const CLOSING_STYLES = [ClosingStyle.Inline, ClosingStyle.InnerIndentation, ClosingStyle.OuterIndentation] as const;
const CLOSING_STYLES_LOWER_CASE: Lowercase<ClosingStyle>[] = CLOSING_STYLES.map(cs =>
    cs.normalize(NORMALIZATION_FORM).toLocaleLowerCase()
) as Lowercase<ClosingStyle>[];

function capitalize(string_: string): string {
    string_ = string_.normalize(NORMALIZATION_FORM);
    let character = string_.at(0);
    if (!character) {
        return string_;
    }
    const uppercase = character.toUpperCase();
    return string_.replace(character, uppercase).normalize(NORMALIZATION_FORM);
    return string_.normalize(NORMALIZATION_FORM);
}

export namespace ClosingStyle {
    export function is(object: any): object is ClosingStyle {
        const result = CLOSING_STYLES.includes(object);
        if (result) {
            console.log(`✅ '${object}'`);
        } else {
            console.log(`❌ '${object}'`);
        }
        return result;
    }

    export function tryFrom(object: any): ClosingStyle | undefined {
        if (ClosingStyle.is(object)) {
            return object;
        }
        if (isLowercase(object)) {
            return tryFromLowercase(object);
        }
        return;
    }

    export function isLowercase(object: any): object is Lowercase<ClosingStyle> {
        return CLOSING_STYLES_LOWER_CASE.includes(object);
    }

    export function tryFromLowercase(string_: Lowercase<ClosingStyle>): ClosingStyle | undefined {
        const result = string_.normalize(NORMALIZATION_FORM).split(' ').map(capitalize).join(' ');
        if (ClosingStyle.is(result)) {
            return result;
        }
        console.warn(`Failed to recase string into ClosingStyle: '${string_}' -> '${result}'`);
        return;
    }
}

export enum CollapsingStyle {
    Never,
    NamedNode = 1,
    Grouping = 2,
    List = 4,

    Parentheses = NamedNode & Grouping,
    NotGrouping = NamedNode & List,
    NotNamedNode = Grouping & List,

    All = NamedNode & Grouping & List,
}

export type MaxInlineChildren = { maxInlineChildren?: number };

export type NodeStyle = {
    maxInlineChildren?: number;
    closingStyle: ClosingStyle;
    hangTopLevelClose: boolean;
};

type ConfigurationNodeStyle = NodeStyle & {
    maxInlineChildren: number | null;
};

namespace ConfigurationNodeStyle {
    export function is(object: any): object is ConfigurationNodeStyle {
        return (
            hasPropertyOfType(object, 'maxInlineChildren', isNumber.orNull) &&
            hasPropertyOfType(object, 'closingStyle', ClosingStyle.is) &&
            hasPropertyOfType(object, 'hangTopLevelClose', isBoolean)
        );
    }
}

export namespace MaxInlineChildren {
    export function is(object: any): object is MaxInlineChildren {
        return hasProperty(object, 'maxInlineChildren', isNumber.orUndefined);
    }

    export function isValid(style?: MaxInlineChildren): style is typeof style & MaxInlineChildren {
        return style === undefined || style.maxInlineChildren === undefined || style.maxInlineChildren >= 0;
    }

    export function isAndIsValid(object: any): object is MaxInlineChildren {
        return (
            !hasProperty(object, 'maxInlineChildren') ||
            object.maxInlineChildren === undefined ||
            (typeof object.maxInlineChildren === 'number' && object.maxInlineChildren >= 0)
        );
    }

    // export function validateOrThrow(style?: MaxInlineChildren, type?: string): void | never {
    //     if (style === undefined || isValid(style)) {
    //         return;
    //     }
    //     const value = hasProperty(style, 'maxInlineChildren') ? style.maxInlineChildren : undefined;
    //     const source = type ? `${type}.maxInlineChildren` : 'maxInlineChildren';
    //     throw `'${source}' must be undefined or non-negative - Given value: ${style.maxInlineChildren!}`;
    // }

    export function sift(object: any): AnchorStyle | {} {
        return isValid(object) ? object : {};
    }
}

export type OuterIndentTopLevelClose = {
    outerIndentTopLevelClose: boolean;
};

namespace OuterIndentTopLevelClose {
    export function is(object: any): object is OuterIndentTopLevelClose {
        return hasPropertyOfType(object, 'outerIndentTopLevelClose', isBoolean);
    }
}

export type AllowInline = {
    allowInline: boolean;
};

export namespace AllowInline {
    export function is(object: any): object is AllowInline {
        return hasPropertyOfType(object, 'allowInline', isBoolean);
    }
    export function sift(object: any): AnchorStyle | {} {
        return is(object) ? object : {};
    }
}

export type AnchorStyle = {
    forceOntoNewline: boolean;
    spaceBeforeClose: boolean;
};

export namespace AnchorStyle {
    export function is(object: any): object is AnchorStyle {
        return (
            hasPropertyOfType(object, 'forceOntoNewline', isBoolean) && hasPropertyOfType(object, 'spaceBeforeClose', isBoolean)
        );
    }

    export function sift(object: any): AnchorStyle | {} {
        return is(object) ? object : {};
    }
}

export type CommentStyle = {} & AllowInline;
namespace CommentStyle {
    export function is(object: any): object is CommentStyle {
        return AllowInline.is(object);
    }
    export function sift(object: any): AnchorStyle | {} {
        return is(object) ? object : {};
    }
}

export type GroupingStyle = NodeStyle;
export type ListStyle = NodeStyle;
export type NamedNodeStyle = NodeStyle;
export type PredicateStyle = NodeStyle & AllowInline;

export interface FitNewlines {
    fitNewlines(count: number): number;
    get isValid(): boolean;
}
type PropertyKeyWithValueNotOfType<O, T, K extends keyof O> = O[K] extends T ? never : K;
type PropertyKeysWithValueNotOfType<O, T, K extends keyof O = keyof O> = K extends PropertyKeyWithValueNotOfType<O, T, K>
    ? K
    : never;
// type NonMethodPropertyKey<T, K extends keyof T> = T[K] extends (...args: any) => any ? never : K;
// export type NonMethodPropertyKeys<T> = NonMethodPropertyKey<T, keyof T>;
export type PartialProperties<T> = { [Key in PropertyKeysWithValueNotOfType<T, (...args: any) => any>]: T[Key] | undefined };

export type SubLevelPartial = SubLevel | Partial<Pick<SubLevel, 'maximumNewlines'>>;

export class SubLevel implements FitNewlines {
    constructor(public maximumNewlines?: number) {
        if (!isPositiveOrUndefined(maximumNewlines)) {
            throw `maximumNewlines must either be undefined or non-negative/non-zero - Given value: ${maximumNewlines}`;
        }
    }

    static is(object: any): object is SubLevel {
        return object instanceof SubLevel;
    }

    static default(): SubLevel {
        return SubLevel.attemptFromPartial();
    }

    static attemptFromPartial(partial: undefined): SubLevel;
    static attemptFromPartial(partial: SubLevel): SubLevel;
    static attemptFromPartial(partial?: SubLevelPartial): undefined extends typeof partial ? SubLevel : SubLevel | undefined;
    static attemptFromPartial(partial?: SubLevelPartial): SubLevel | undefined {
        if (partial instanceof SubLevel) {
            return partial;
        }
        try {
            const maximumNewlines = partial?.maximumNewlines === undefined ? 1 : partial.maximumNewlines;
            return new SubLevel(maximumNewlines);
        } catch (e) {
            console.warn(e);
        }
        return;
    }

    get isValid(): boolean {
        return isPositiveOrUndefined(this.maximumNewlines);
    }

    fitNewlines(count: number): number {
        count = Math.max(1, count);
        if (this.maximumNewlines) {
            count = Math.min(count, this.maximumNewlines);
        }
        return count;
    }
}

type TopLevelPartial = Partial<Pick<TopLevel, 'minimumNewlines' | 'maximumNewlines'>>;

export class TopLevel implements FitNewlines {
    constructor(public minimumNewlines: number, public maximumNewlines?: number) {
        if (minimumNewlines < 0) {
            throw `minimumNewlines may not be negative - Given value: ${maximumNewlines}`;
        }
        if (maximumNewlines !== undefined && maximumNewlines < 1) {
            throw `maximumNewlines must either be undefined or non-negative. Given value: ${maximumNewlines}`;
        }
    }

    static default(): TopLevel {
        return new TopLevel(1, 3);
    }

    static attemptFromPartial(partial?: TopLevelPartial): undefined extends typeof partial ? TopLevel : TopLevel | undefined;
    static attemptFromPartial(partial?: TopLevelPartial): TopLevel | undefined {
        try {
            const minimumNewlines: number = !partial?.minimumNewlines ? 1 : partial.minimumNewlines;
            const maximumNewlines: number | undefined = !partial ? 2 : partial?.maximumNewlines;
            return new TopLevel(minimumNewlines, maximumNewlines);
        } catch (e) {
            console.warn(e);
        }
        return undefined;
    }

    get isValid(): boolean {
        return [this.minimumNewlines, this.maximumNewlines].every(isPositiveOrUndefined);
    }

    fitNewlines(count: number): number {
        count = Math.max(1, this.minimumNewlines, count);
        if (this.maximumNewlines) {
            count = Math.min(count, this.maximumNewlines);
        }
        return count;
    }
}

export type StylePartial = {
    anchors?: Partial<AnchorStyle>;
    comments?: Partial<CommentStyle>;
    groupings?: Partial<GroupingStyle>;
    lists?: Partial<ListStyle>;
    namedNodes?: Partial<NamedNodeStyle>;
    predicates?: Partial<PredicateStyle>;

    topLevel?: TopLevel | TopLevelPartial;
    subLevel?: SubLevel | SubLevelPartial;

    options?: Partial<lsp.FormattingOptions>;
};

export class FormattingStyle {
    constructor(
        public anchors: AnchorStyle,
        public comments: CommentStyle,
        public groupings: GroupingStyle,
        public lists: ListStyle,
        public namedNodes: NamedNodeStyle,
        public predicates: PredicateStyle,

        public topLevel: TopLevel,
        public subLevel: SubLevel,

        // public forceOntoNewline: ForceOntoNewline,
        // public newlines: Newlines,
        public options: lsp.FormattingOptions
    ) {}

    get tabSize(): number {
        return this.options.tabSize;
    }

    get isValid(): boolean {
        return (
            [
                this.groupings.maxInlineChildren,
                this.lists.maxInlineChildren,
                this.namedNodes.maxInlineChildren,
                this.predicates.maxInlineChildren,
                this.options.tabSize,
            ].every(isPositiveOrUndefined) &&
            this.topLevel.isValid &&
            this.subLevel.isValid
        );
    }

    static default(): FormattingStyle {
        const anchors: AnchorStyle = {
            forceOntoNewline: false,
            spaceBeforeClose: false,
        };
        const comments: CommentStyle = {
            allowInline: true,
        };
        const groupings: GroupingStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.Inline,
            hangTopLevelClose: true,
        };
        const lists: ListStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.OuterIndentation,
            hangTopLevelClose: true,
        };
        const namedNodes: NamedNodeStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.Inline,
            hangTopLevelClose: false,
        };
        const predicates: PredicateStyle = {
            closingStyle: ClosingStyle.Inline,
            allowInline: false,
            hangTopLevelClose: false,
        };

        const options = {
            tabSize: 2,
            insertSpaces: true,
            insertFinalNewline: true,
            trimFinalNewlines: true,
            trimTrailingWhitespace: true,
        };

        return new FormattingStyle(
            anchors,
            comments,
            groupings,
            lists,
            namedNodes,
            predicates,

            new TopLevel(1, 2),
            new SubLevel(1),

            options
        );
        return FormattingStyle.fromPartial({});
    }

    static fromPartial(partial: StylePartial): FormattingStyle {
        if (partial.options?.tabSize && partial.options.tabSize < 0) {
            console.warn(
                `'FormattingOptions.tabSize' must be undefined or non-negative - Given value: ${partial.options.tabSize}`
            );
            partial.options.tabSize = 2;
        }
        const anchors: AnchorStyle = {
            forceOntoNewline: false,
            spaceBeforeClose: false,
        };
        const comments: CommentStyle = {
            allowInline: true,
        };
        const groupings: GroupingStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.Inline,
            hangTopLevelClose: true,
            ...(MaxInlineChildren.isValid(partial.groupings) ? partial.groupings : {}),
        };
        const lists: ListStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.OuterIndentation,
            hangTopLevelClose: true,
            ...(MaxInlineChildren.isValid(partial.lists) ? partial.lists : {}),
        };
        const namedNodes: NamedNodeStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.Inline,
            hangTopLevelClose: false,
            ...(MaxInlineChildren.isValid(partial.namedNodes) ? partial.namedNodes : {}),
        };
        const predicates: PredicateStyle = {
            closingStyle: ClosingStyle.Inline,
            allowInline: false,
            hangTopLevelClose: false,
            ...(MaxInlineChildren.isValid(partial.predicates) ? partial.predicates : {}),
        };

        const options = {
            tabSize: 2,
            insertSpaces: true,
            insertFinalNewline: true,
            trimFinalNewlines: true,
            trimTrailingWhitespace: true,
        };

        return new FormattingStyle(
            { ...anchors, ...(partial.anchors ?? {}) },
            { ...comments, ...(partial.comments ?? {}) },
            groupings,
            lists,
            namedNodes,
            predicates,

            TopLevel.attemptFromPartial(partial.topLevel) ?? TopLevel.default(),
            SubLevel.attemptFromPartial(partial.subLevel) ?? SubLevel.default(),

            { ...options, ...(partial.options ?? {}) }
        );
    }

    /**
     * massages a given object into a FormattingStyle
     * NOTE: discards invalid values
     */
    static fromObject(object?: any, options?: FormattingOptions): FormattingStyle {
        let style = FormattingStyle.default();

        if (!object) {
            return style;
        }

        if (object.options?.tabSize && object.options.tabSize < 0) {
            console.warn(
                `'FormattingOptions.tabSize' must be undefined or non-negative - Given value: ${object.options.tabSize}`
            );
            object.options.tabSize = 2;
        }

        if (hasProperty(object, 'anchors', isObject)) {
            const anchors = object.anchors;
            if (hasProperty(anchors, 'forceOntoNewline', isBoolean)) {
                style.anchors.forceOntoNewline = anchors.forceOntoNewline;
            }
            if (hasProperty(anchors, 'spaceBeforeClose', isBoolean)) {
                style.anchors.spaceBeforeClose = anchors.spaceBeforeClose;
            }
        }

        if (hasProperty(object, 'comments') && hasProperty(object.comments, 'allowInline', isBoolean)) {
            style.comments.allowInline = object.comments.allowInline;
        }

        if (hasProperty(object, 'groupings', isObject)) {
            const groupings = object.groupings;
            if (MaxInlineChildren.isAndIsValid(groupings)) {
                style.groupings.maxInlineChildren = groupings.maxInlineChildren;
            }
            if (hasProperty(groupings, 'closingStyle')) {
                const closingStyle: ClosingStyle | undefined = ClosingStyle.tryFrom(groupings.closingStyle);
                if (ClosingStyle.is(closingStyle)) {
                    style.groupings.closingStyle = closingStyle;
                }
            }
            if (hasProperty(groupings, 'hangTopLevelClose', isBoolean)) {
                style.groupings.hangTopLevelClose = groupings.hangTopLevelClose;
            }
        }

        if (hasProperty(object, 'lists', isObject)) {
            const lists = object.lists;
            if (MaxInlineChildren.isAndIsValid(lists)) {
                style.lists.maxInlineChildren = lists.maxInlineChildren;
            }
            if (hasProperty(lists, 'closingStyle')) {
                const closingStyle: ClosingStyle | undefined = ClosingStyle.tryFrom(lists.closingStyle);
                if (ClosingStyle.is(closingStyle)) {
                    style.lists.closingStyle = closingStyle;
                }
            }
            if (hasProperty(lists, 'hangTopLevelClose', isBoolean)) {
                style.lists.hangTopLevelClose = lists.hangTopLevelClose;
            }
        }

        if (hasProperty(object, 'namedNodes', isObject)) {
            const namedNodes = object.namedNodes;
            if (MaxInlineChildren.isAndIsValid(namedNodes)) {
                style.namedNodes.maxInlineChildren = namedNodes.maxInlineChildren;
            }
            if (hasProperty(namedNodes, 'closingStyle')) {
                const closingStyle: ClosingStyle | undefined = ClosingStyle.tryFrom(namedNodes.closingStyle);
                if (ClosingStyle.is(closingStyle)) {
                    style.namedNodes.closingStyle = closingStyle;
                }
            }
            if (hasProperty(namedNodes, 'hangTopLevelClose', isBoolean)) {
                style.namedNodes.hangTopLevelClose = namedNodes.hangTopLevelClose;
            }
        }

        if (hasProperty(object, 'predicates', isObject)) {
            const predicates = object.predicates;
            if (MaxInlineChildren.isAndIsValid(predicates)) {
                style.predicates.maxInlineChildren = predicates.maxInlineChildren;
            }
            if (hasProperty(predicates, 'closingStyle')) {
                const closingStyle: ClosingStyle | undefined = ClosingStyle.tryFrom(predicates.closingStyle);
                if (ClosingStyle.is(closingStyle)) {
                    style.predicates.closingStyle = closingStyle;
                }
            }
            if (hasProperty(predicates, 'hangTopLevelClose', isBoolean)) {
                style.predicates.hangTopLevelClose = predicates.hangTopLevelClose;
            }
            if (hasProperty(predicates, 'allowInline', isBoolean)) {
                style.predicates.allowInline = predicates.allowInline;
            }
        }

        if (hasProperty(object, 'topLevel') && object.topLevel instanceof TopLevel) {
            style.topLevel = object.topLevel;
        } else if (hasProperty(object, 'topLevel', isObject)) {
            const topLevel = TopLevel.attemptFromPartial(object.topLevel);
            if (!!topLevel) {
                style.topLevel = topLevel;
            }
        }

        if (hasProperty(object, 'subLevel', SubLevel.is)) {
            style.subLevel = object.subLevel;
        } else if (hasProperty(object, 'subLevel', isObject) && hasProperty(object.subLevel, 'maximumNewlines', isNumber)) {
            try {
                const subLevel = new SubLevel(object.subLevel.maximumNewlines);
                style.subLevel = subLevel;
            } catch (e) {
                console.warn('invalid subLevel value');
            }
        }

        if (!!options) {
            style.options = options;
        }

        console.log(style.groupings.closingStyle);

        return style;
    }

    withOptions(options: lsp.FormattingOptions): FormattingStyle {
        this.options = options;
        return this;
    }

    maxChildren(type: string): undefined | number;
    maxChildren(node: TSNode): undefined | number;
    maxChildren(arg0: TSNode | string): undefined | number {
        let type = typeof arg0 === 'string' ? arg0 : arg0.type;
        switch (type) {
            case 'grouping':
                return this.groupings.maxInlineChildren;
            case 'list':
                return this.lists.maxInlineChildren;
            case 'named_node':
                return this.namedNodes.maxInlineChildren;
            case 'parameters':
                return this.predicates.maxInlineChildren;
        }
        return;
    }

    static fromConfiguration(config: FormattingConfiguration, options: lsp.FormattingOptions): FormattingStyle {
        return this.fromPartial({
            ...config,
            groupings: {
                ...config.groupings,
                maxInlineChildren: config.groupings.maxInlineChildren === null ? undefined : config.groupings.maxInlineChildren,
            },
            lists: {
                ...config.lists,
                maxInlineChildren: config.lists.maxInlineChildren === null ? undefined : config.lists.maxInlineChildren,
            },
            namedNodes: {
                ...config.namedNodes,
                maxInlineChildren:
                    config.namedNodes.maxInlineChildren === null ? undefined : config.namedNodes.maxInlineChildren,
            },
            predicates: {
                ...config.predicates,
                maxInlineChildren:
                    config.predicates.maxInlineChildren === null ? undefined : config.predicates.maxInlineChildren,
            },
            topLevel: {
                ...config.topLevel,
                maximumNewlines: config.topLevel.maximumNewlines === null ? undefined : config.topLevel.maximumNewlines,
            },
            subLevel: {
                maximumNewlines: config.subLevel.maximumNewlines === null ? undefined : config.subLevel.maximumNewlines,
            },
            options,
        });
    }
}

export type FormattingOptions = lsp.FormattingOptions & {
    allowInlineComments: boolean;
    allowInlinePredicates: boolean;
    forceAnchorsOntoOwnLine: boolean;
    minNewlinesBetweenTopLevelNodes: number;
    maxNewlinesBetweenTopLevelNodes?: number;
    maxNewlinesBetweenSubNodes?: number;
    maxInlineGroupingElements?: number;
    maxInlineListElements?: number;
    maxInlineNamedNodeElements?: number;
    maxInlineParameterElements?: number;
    listClosingStyle: ClosingStyle;
    groupingClosingStyle: ClosingStyle;
    namedNodeClosingStyle: ClosingStyle;
    hangTopLevelGroupings: boolean;
};

export function FormattingOptions(options: Partial<FormattingOptions> = {}): FormattingOptions {
    return {
        ...FormattingOptions.DEFAULT,
        ...options,
    };
}

export namespace FormattingOptions {
    export const DEFAULT: FormattingOptions = {
        insertSpaces: true,
        tabSize: 2,
        allowInlineComments: true,
        forceAnchorsOntoOwnLine: false,
        minNewlinesBetweenTopLevelNodes: 1,
        maxNewlinesBetweenTopLevelNodes: 2,
        maxNewlinesBetweenSubNodes: 1,
        maxInlineListElements: 3,
        maxInlineGroupingElements: 4,
        maxInlineNamedNodeElements: 3,
        allowInlinePredicates: false,
        listClosingStyle: ClosingStyle.OuterIndentation,
        groupingClosingStyle: ClosingStyle.Inline,
        namedNodeClosingStyle: ClosingStyle.Inline,
        trimTrailingWhitespace: true,
        insertFinalNewline: true,
        trimFinalNewlines: true,
        hangTopLevelGroupings: true,
    };

    export function isValid(options: FormattingOptions): boolean {
        return (
            options.tabSize >= 1 &&
            options.minNewlinesBetweenTopLevelNodes >= 1 &&
            (options.maxNewlinesBetweenTopLevelNodes === undefined ||
                (options.maxNewlinesBetweenTopLevelNodes >= 1 &&
                    options.maxNewlinesBetweenTopLevelNodes > options.minNewlinesBetweenTopLevelNodes))
        );
    }
}

type UndefinedOr<T> = T extends undefined ? never : undefined | T;

type UndefinedsToNulls<T> = {
    [Key in keyof Required<T>]-?: Required<T>[Key] extends undefined | infer K
        ? Exclude<K, undefined> | null
        : Exclude<Required<T>[Key], undefined>;
};

type ConfigurationTopLevel = { minimumNewlines: number; maximumNewlines: number | null };
// type ConfigurationTopLevel = UndefinedsToNulls<TopLevel>
namespace ConfigurationTopLevel {
    export function is(object: any): object is ConfigurationTopLevel {
        return (
            hasPropertyOfType(object, 'minimumNewlines', isNumber) &&
            hasPropertyOfType(object, 'maximumNewlines', isNumber.orNull)
        );
    }
}
type ConfigurationSubLevel = { maximumNewlines: number | null };
namespace ConfigurationSubLevel {
    export function is(object: any): object is ConfigurationSubLevel {
        return hasPropertyOfType(object, 'maximumNewlines', isNumber.orNull);
    }
}

type FormattingConfiguration = {
    anchors: AnchorStyle;
    comments: CommentStyle;
    groupings: ConfigurationNodeStyle;
    lists: ConfigurationNodeStyle;
    namedNodes: ConfigurationNodeStyle;
    predicates: ConfigurationNodeStyle & AllowInline;

    topLevel: ConfigurationTopLevel;
    subLevel: ConfigurationSubLevel;
};

export namespace FormattingConfiguration {
    export type Partial = {};

    export function is(object: any): object is FormattingConfiguration {
        return (
            AnchorStyle.is(object['anchors']) &&
                CommentStyle.is(object['comments']) &&
                ConfigurationNodeStyle.is(object['groupings']) &&
                ConfigurationNodeStyle.is(object['lists']) &&
                ConfigurationNodeStyle.is(object['namedNodes']) &&
                ConfigurationNodeStyle.is(object['predicates']) &&
                AllowInline.is(object['predicates']) &&
                hasPropertyOfType(object, 'topLevel', isObject),
            hasPropertyOfType(object, 'subLevel', isObject)
        );
    }
}
