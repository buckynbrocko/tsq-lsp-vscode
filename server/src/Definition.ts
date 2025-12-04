import { AbstractDefinitionChild, DefinitionChild, TraversalOptions } from './DefinitionChild';
import { Grammar } from './Grammar';
import { firstOf } from './itertools';
import { nameOfNamedNode } from './junk_drawer';
import { QueryFile } from './QueryFile';
import { TSNode } from './reexports';
import Rule from './Rule';
import { KindaTerminal, NonTerminal, PseudoTerminal, Terminal, Terminality } from './Terminality';
import { FieldName } from './typeChecking';

export type Definition = NamedNode | AnonymousNode | MissingNode | List | Grouping | FieldDefinition;

export namespace Definition {
    export type NodeType = Definition['nodeType'];
    const TERMINAL_NODE_TYPES: Terminal<Definition>['nodeType'][] = ['anonymous_node', 'missing_node'] as const;
    const PSEUDO_TERMINAL_TYPES: PseudoTerminal<Definition>['nodeType'][] = ['named_node', 'field_definition'] as const;
    const NON_TERMINAL_NODE_TYPES: NonTerminal<Definition>['nodeType'][] = ['grouping', 'list'] as const;
    const NODE_TYPES: NodeType[] = [...TERMINAL_NODE_TYPES, ...NON_TERMINAL_NODE_TYPES, ...PSEUDO_TERMINAL_TYPES] as const;

    export function is(arg: any): arg is Definition {
        return arg instanceof AbstractDefinition;
    }

    export function isType<T extends NodeType>(node: Definition, ...types: T[]): node is Extract<Definition, { nodeType: T }> {
        return types.includes(node.nodeType as T);
    }

    export function tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | Grammar): Definition | undefined {
        switch (node.type) {
            case 'named_node':
                return NamedNode.tryFrom(node, queryFileOrGrammar);
            case 'anonymous_node':
                return AnonymousNode.tryFrom(node, queryFileOrGrammar);
            case 'missing_node':
                return MissingNode.tryFrom(node, queryFileOrGrammar);
            case 'list':
                return List.tryFrom(node, queryFileOrGrammar);
            case 'grouping':
                return Grouping.tryFrom(node, queryFileOrGrammar);
            case 'field_definition':
                return FieldDefinition.tryFrom(node, queryFileOrGrammar);
            default:
                return;
        }
    }

    export function isCompatible(node: TSNode): node is typeof node & { type: NodeType } {
        return NODE_TYPES.includes(node.type as NodeType);
    }
}

abstract class AbstractDefinition extends AbstractDefinitionChild {
    hasNoChildren(options: TraversalOptions = TraversalOptions.DEFAULT): boolean {
        return !this.children(options).length;
    }

    rules(): KindaTerminal<Rule>[] {
        return this.grammar.rulesForDefinition(this as unknown as Definition);
    }
}

export class NamedNode extends AbstractDefinition {
    readonly nodeType = 'named_node';
    readonly isTerminal_ = true;
    readonly terminality = Terminality.PseudoTerminal;

    private constructor(
        public node: TSNode, //
        readonly _queryFileOrGrammar: QueryFile | Grammar,
        public name: string,
        public supertype?: string
    ) {
        super();
    }

    get isWildcard(): boolean {
        return this.name === '_';
    }

    get isExtra() {
        return this.grammar.extrasNames.has(this.name) || this.grammar.extras.some(rule => rule.matchesTerminalNode(this.node));
    }

    get corespondsToStartRule(): boolean {
        return this.grammar.getByName(this.name).some(rule => rule.id === 0);
    }

    firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors?: false }): KindaTerminal<DefinitionChild>[];
    firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
    firstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        for (let child of this.yieldChildren(options)) {
            if (child.isTerminal_) {
                return child.thisOrFirstKindaTerminalChildren(options);
            }
        }
        return [];
    }

    static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | Grammar): NamedNode | undefined {
        if (node.type !== 'named_node') {
            return;
        }
        let name = nameOfNamedNode(node);
        if (!name) {
            return;
        }
        let supertype = node.childForFieldName('supertype')?.text;
        return new NamedNode(node, queryFileOrGrammar, name, supertype);
    }
    format(): string {
        return `(${this.name})`;
    }
}

export class AnonymousNode extends AbstractDefinition {
    readonly nodeType = 'anonymous_node';
    readonly isTerminal_ = true;
    readonly terminality = Terminality.Terminal;
    private constructor(
        public node: TSNode, //
        readonly _queryFileOrGrammar: QueryFile | Grammar,
        public name: string,
        public isWildcard: boolean
    ) {
        super();
    }

    firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
    firstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        return [];
    }

    static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | Grammar): AnonymousNode | undefined {
        if (node.type !== 'anonymous_node') {
            return undefined;
        }
        let nameAndWildcard = TSNode.nameOfAnonymousNode(node);
        if (!nameAndWildcard) {
            return;
        }
        let [name, isWildcard] = nameAndWildcard;
        return new AnonymousNode(node, queryFileOrGrammar, name, isWildcard);
    }

    format(): string {
        return this.isWildcard ? '_' : `"${this.name}"`;
    }
}

export class MissingNode extends AbstractDefinition {
    readonly isTerminal_ = true;
    readonly nodeType = 'missing_node';
    readonly terminality = Terminality.Terminal; // NOTE this will change later
    private constructor(
        public node: TSNode, //
        readonly _queryFileOrGrammar: QueryFile | Grammar
    ) {
        super();
    }

    firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
    firstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        return [];
    }

    static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | Grammar): MissingNode | undefined {
        if (node.type !== 'missing_node') {
            return undefined;
        }
        return new MissingNode(node, queryFileOrGrammar);
    }

    format(): string {
        return '(MISSING)';
    }
}

export class List extends AbstractDefinition {
    readonly isTerminal_ = false;
    readonly nodeType = 'list';
    readonly terminality = Terminality.NonTerminal;
    private constructor(
        public node: TSNode, ///
        readonly _queryFileOrGrammar: QueryFile | Grammar
    ) {
        super();
    }

    firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
    firstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        return this.children(options).flatMap(child => child.thisOrFirstKindaTerminalChildren(options));
    }

    static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | Grammar): List | undefined {
        if (node.type !== 'list') {
            return;
        }
        return new List(node, queryFileOrGrammar);
    }
    format(): string {
        return `[...]`;
    }
}

export class Grouping extends AbstractDefinition {
    readonly isTerminal_ = false;
    readonly terminality = Terminality.NonTerminal;

    readonly nodeType = 'grouping';
    private constructor(
        public node: TSNode, ///
        readonly _queryFileOrGrammar: QueryFile | Grammar
    ) {
        super();
    }

    firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
    firstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        for (let child of this.yieldChildren(options)) {
            if (child.isTerminal_) {
                return child.thisOrFirstKindaTerminalChildren(options);
            }
        }
        return [];
    }

    static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | Grammar): Grouping | undefined {
        if (node.type !== 'grouping') {
            return;
        }
        return new Grouping(node, queryFileOrGrammar);
    }
    format(): string {
        return '(...)';
    }
}

export class FieldDefinition extends AbstractDefinition {
    readonly isTerminal_ = true;
    readonly terminality = Terminality.PseudoTerminal;

    readonly nodeType = 'field_definition';
    private constructor(
        public node: TSNode, ///
        readonly _queryFileOrGrammar: QueryFile | Grammar,
        public name: string
    ) {
        super();
    }

    firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
    firstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        return []; // TODO
    }

    get value(): Definition | undefined {
        return firstOf(this.children());
    }

    // terminalChildren(): MetaNode[] {
    //     return []; // TODO
    // }
    static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | Grammar): FieldDefinition | undefined {
        if (node.type !== 'field_definition') {
            return;
        }
        let name = FieldName.fromNode(node);
        if (!name) {
            return;
        }
        return new FieldDefinition(node, queryFileOrGrammar, name);
    }
    format(): string {
        return `${this.name}: ${firstOf(this.children())?.format() ?? '...'}`;
    }
}
