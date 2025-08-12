import * as lsp from 'vscode-languageserver';
import { isPositiveOrUndefined } from '../predicates';
import { TSNode } from '../reexports';

export enum ClosingStyle {
    Connected = 'Connected',
    Hanging = 'Hanging',
    Tucked = 'Tucked',
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

export type NodeStyle = {
    maxInlineChildren?: number;
    closingStyle: ClosingStyle;
    hangTopLevelClose: boolean;
};

export type NamedNodeStyle = NodeStyle;

export type HangTopLevelClose = {
    hangTopLevelClose: boolean;
};

export type GroupingStyle = NodeStyle;
export type ListStyle = NodeStyle;

export type AllowInline = {
    allowInline: boolean;
};

export type PredicateStyle = NodeStyle & AllowInline;

export type CommentStyle = {} & AllowInline;

export type ForceOntoNewline = {
    anchors: boolean;
};

export interface FitNewlines {
    fitNewlines(count: number): number;
    get isValid(): boolean;
}

export class SubLevel implements FitNewlines {
    constructor(public maximumNewlines?: number) {}

    static default(): SubLevel {
        return new SubLevel(1);
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

export class TopLevel implements FitNewlines {
    constructor(public minimumNewlines: number, public maximumNewlines?: number) {}

    static default(): TopLevel {
        return new TopLevel(1, 2);
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

// export type SubLevel = {
//     maximumNewlines?: number;
// };

// export type TopLevel = SubLevel & {
//     minimumNewlines: number;
// };

// export type Newlines = {
//     minTopLevel: number;
//     maxTopLevel?: number;
//     maxSubLevel?: number;
// };

export type AnchorStyle = {
    forceOntoNewline: boolean;
    spaceBeforeClose: boolean;
};

type PartialStyle = {
    anchors?: Partial<AnchorStyle>;
    comments?: Partial<CommentStyle>;
    groupings?: Partial<GroupingStyle>;
    lists?: Partial<ListStyle>;
    namedNodes?: Partial<NamedNodeStyle>;
    predicates?: Partial<PredicateStyle>;

    topLevel?: TopLevel;
    subLevel?: SubLevel;

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
        return FormattingStyle.fromPartial({});
    }

    static fromPartial(partial: PartialStyle): FormattingStyle {
        const anchors: AnchorStyle = {
            forceOntoNewline: false,
            spaceBeforeClose: false,
        };
        const comments: CommentStyle = {
            allowInline: true,
        };
        const groupings: GroupingStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.Connected,
            hangTopLevelClose: true,
        };
        const lists: ListStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.Hanging,
            hangTopLevelClose: true,
        };
        const namedNodes: NamedNodeStyle = {
            maxInlineChildren: 2,
            closingStyle: ClosingStyle.Connected,
            hangTopLevelClose: false,
        };
        const predicates: PredicateStyle = {
            // maxInlineChildren: 1,
            closingStyle: ClosingStyle.Connected,
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
            { ...anchors, ...(partial.anchors ?? {}) },
            { ...comments, ...(partial.comments ?? {}) },
            { ...groupings, ...(partial.groupings ?? {}) },
            { ...lists, ...(partial.lists ?? {}) },
            { ...namedNodes, ...(partial.namedNodes ?? {}) },
            { ...predicates, ...(partial.predicates ?? {}) },

            partial.topLevel ?? TopLevel.default(),
            partial.subLevel ?? SubLevel.default(),

            { ...options, ...(partial.options ?? {}) }
        );
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
        listClosingStyle: ClosingStyle.Hanging,
        groupingClosingStyle: ClosingStyle.Connected,
        namedNodeClosingStyle: ClosingStyle.Connected,
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
