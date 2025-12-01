import * as WTS from 'web-tree-sitter';
import { Dict } from './Dict';
import { firstOf } from './itertools';
import { alwaysReturnsTrue, nameOfNamedNode } from './junk_drawer';
import { isNotNullish } from './predicates';
import { QueryGrammar } from './QueryGrammar';
import { TSNode } from './reexports';
import { HasTerminality, KindaTerminal, NonTerminal, PseudoTerminal, Terminal, Terminality } from './Terminality';
import { FieldName } from './typeChecking';

export function isAnchor(node: TSNode): boolean {
    return node.type === '.' && node.isNamed;
}

export type Definition =
    | Definition.NamedNode
    | Definition.AnonymousNode
    | Definition.MissingNode
    | Definition.List
    | Definition.Grouping
    | Definition.FieldDefinition;

// export type MetaNodeType
export type TerminalDefinition = Terminal<Definition>;
export type PseudoTerminalDefinition = PseudoTerminal<Definition>;
export type NonTerminalDefinition = NonTerminal<Definition>;

export type KindaTerminalDefinition = Terminal<Definition> | PseudoTerminal<Definition>;
export type KindaNonTerminalDefinition = NonTerminal<Definition> | PseudoTerminal<Definition>;

export class QueryFile {
    private _topLevelNodes: Definition[] = [];
    constructor(public grammar: QueryGrammar, private _nodes: Dict<number, Definition> = new Dict()) {}

    get IDs(): Set<number> {
        return new Set(this._nodes.keys());
    }

    get topLevelNodes(): Definition[] {
        return [...this._topLevelNodes];
    }

    *yieldNodes() {
        for (let node of this._nodes.values()) {
            yield node;
        }
        return;
    }

    nodesOfType<T extends Definition['nodeType']>(...nodeTypes: T[]): Extract<Definition, { nodeType: T }>[] {
        return this._nodes.valuesArray().filter(node => Definition.isType(node, ...nodeTypes));
    }

    has(arg: number | Definition): boolean {
        let id = typeof arg === 'number' ? arg : arg.id;
        return this._nodes.has(id);
    }

    public getNodeByID(id: number): Definition | undefined {
        return this._nodes.get(id);
    }

    private addNode(node: Definition) {
        if (this.has(node)) {
            console.warn(`${Object.getPrototypeOf(this).name} already has node id ${node.id}`);
        }
        this._nodes.set(node.id, node);
    }

    getOrTryNew(node: TSNode) {
        return this._nodes.get(node.id) ?? this.tryNewNode(node);
    }

    tryNewNode(node: TSNode): Definition | undefined {
        let newNode = Definition.tryFrom(node, this);
        if (!!newNode) {
            this.addNode(newNode);
        }
        return newNode;
    }

    static fromTree(tree: WTS.Tree, grammar: QueryGrammar) {
        const rootNode = tree.rootNode;
        let instance = new QueryFile(grammar);
        for (let child of rootNode.children) {
            if (child !== null) {
                let node = instance.tryNewNode(child);
                if (!!node) {
                    instance._topLevelNodes.push(node);
                }
            }
        }
        return instance;
    }

    static tryFromTree(tree: WTS.Tree | undefined, grammar: QueryGrammar): QueryFile | undefined {
        if (!tree) {
            return;
        }
        try {
            return QueryFile.fromTree(tree, grammar);
        } catch {}
        return;
    }
}

export namespace Definition {
    export type NodeType = Definition['nodeType'];
    const TERMINAL_NODE_TYPES: Terminal<Definition>['nodeType'][] = ['anonymous_node', 'missing_node'] as const;
    const PSEUDO_TERMINAL_TYPES: PseudoTerminal<Definition>['nodeType'][] = ['named_node', 'field_definition'] as const;
    const NON_TERMINAL_NODE_TYPES: NonTerminal<Definition>['nodeType'][] = ['grouping', 'list'] as const;
    const NODE_TYPES: NodeType[] = [...TERMINAL_NODE_TYPES, ...NON_TERMINAL_NODE_TYPES, ...PSEUDO_TERMINAL_TYPES] as const;

    export function isType<T extends NodeType>(node: Definition, ...types: T[]): node is Extract<Definition, { nodeType: T }> {
        return types.includes(node.nodeType as T);
    }

    export function tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | QueryGrammar): Definition | undefined {
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

    function isNotExtra(node: Definition): boolean {
        return !node.isExtra;
    }

    type hmm = Definition.AnonymousNode['terminality'];

    abstract class AbstractDefinition implements HasTerminality {
        abstract readonly nodeType: string;
        abstract isTerminal: boolean;
        abstract readonly terminality: Terminality;
        public abstract node: TSNode;
        abstract readonly _queryFileOrGrammar: QueryGrammar | QueryFile;

        get queryFile(): QueryFile | undefined {
            return this._queryFileOrGrammar instanceof QueryFile ? this._queryFileOrGrammar : undefined;
        }

        get grammar(): QueryGrammar {
            let thing = this._queryFileOrGrammar;
            return thing instanceof QueryGrammar ? thing : thing.grammar;
        }

        get id(): number {
            return this.node.id;
        }

        get asTerminal(): Terminal<Definition> | undefined {
            return Terminality.isTerminal(this.asMetaNode) ? this.asMetaNode : undefined;
        }

        get asPseudoTerminal(): PseudoTerminal<Definition> | undefined {
            return Terminality.isPseudoTerminal(this.asMetaNode) ? this.asMetaNode : undefined;
        }

        get asNonTerminal(): NonTerminal<Definition> | undefined {
            return Terminality.isNonTerminal(this.asMetaNode) ? this.asMetaNode : undefined;
        }

        get isPseudoTerminal(): boolean {
            return this.terminality === Terminality.PseudoTerminal;
        }

        get isNonTerminal(): boolean {
            return !this.isTerminal;
        }

        get isKindaTerminal(): boolean {
            return this.isTerminal || this.isPseudoTerminal;
        }

        get isKindaNonTerminal(): boolean {
            return this.isNonTerminal || this.isPseudoTerminal;
        }

        get isExtra() {
            return this.grammar.extras.some(rule => rule.matchesTerminalNode(this.node));
        }

        get parent(): Definition | undefined {
            return !this.node.parent ? undefined : this.getOrTryNewNode(this.node.parent);
        }

        private extraFilter(shouldSkip: boolean) {
            return shouldSkip ? isNotExtra : alwaysReturnsTrue;
        }

        *yieldAncestors() {
            let ancestor = this.parent;
            while (ancestor) {
                yield ancestor;
                ancestor = ancestor.parent;
            }
            return;
        }

        hasDescendant(definition: Definition): boolean {
            for (let ancestor of definition.yieldAncestors()) {
                if (ancestor.id === this.id) {
                    return true;
                }
            }
            return false;
        }

        *yieldChildren(skipExtras: boolean = true) {
            for (let child of this.children(skipExtras)) {
                yield child;
            }
            return;
        }

        thisOrTerminalChildren(skipExtras: boolean = true): KindaTerminalDefinition[] {
            let dontSkip = this.extraFilter(skipExtras);
            return this.isTerminal && dontSkip(this.asMetaNode)
                ? [this.asMetaNode as TerminalDefinition]
                : this.terminalChildren(skipExtras);
        }

        terminalChildren(skipExtras = true): KindaTerminalDefinition[] {
            return this.children(skipExtras).flatMap(child => child.thisOrTerminalChildren(skipExtras));
            // .filter(this.extraFilter(skipExtras));
        }

        abstract firstTerminalChildren(skipExtras: boolean): KindaTerminalDefinition[];

        private get asMetaNode(): Definition {
            return this as unknown as Definition;
        }

        thisOrFirstTerminalChildren(skipExtras = true): KindaTerminalDefinition[] {
            return this.isTerminal && this.extraFilter(skipExtras)(this.asMetaNode)
                ? [this.asMetaNode as KindaTerminalDefinition]
                : this.firstTerminalChildren(skipExtras);
        }

        *yieldPreviousSiblings(skipExtras: boolean = true) {
            let dontSkip = this.extraFilter(skipExtras);
            for (let siblingNode of TSNode.yieldPreviousSiblings(this.node)) {
                let previous = this.getOrTryNewNode(siblingNode);
                if (!!previous && dontSkip(previous)) {
                    yield previous;
                }
            }
        }

        previousSibling(skipExtras: boolean = true): Definition | undefined {
            return firstOf(this.yieldPreviousSiblings(skipExtras));
        }

        *yieldNextSiblings(skipExtras: boolean = true) {
            let dontSkip = this.extraFilter(skipExtras);
            for (let siblingNode of TSNode.yieldNextSiblings(this.node)) {
                let next = this.getOrTryNewNode(siblingNode);
                // let next = MetaNode.tryFrom(siblingNode, this.grammar);
                if (!!next && dontSkip(next)) {
                    yield next;
                }
            }
        }

        nextSibling(skipExtras: boolean = true): Definition | undefined {
            return firstOf(this.yieldNextSiblings(skipExtras));
        }

        nextTerminals(skipExtras = true): KindaTerminal<Definition>[] {
            let parent = this.parent;
            if (this.node.parent?.type === 'program') {
                return [];
            }
            if (parent?.nodeType === 'list') {
                return parent.nextTerminals(skipExtras);
            }

            let next = this.nextSibling(skipExtras)?.thisOrFirstTerminalChildren(skipExtras) ?? [];
            if (!!next.length) {
                return next;
            }

            return parent?.nextTerminals(skipExtras) ?? [];
        }

        get isAnchoredLeft(): boolean {
            for (let previous of TSNode.yieldPreviousSiblings(this.node)) {
                if (previous.isExtra) {
                    continue;
                }
                return isAnchor(previous);
            }
            return false;
        }

        get isAnchoredRight(): boolean {
            for (let next of TSNode.yieldNextSiblings(this.node)) {
                if (next.isExtra) {
                    continue;
                }
                return isAnchor(next);
            }
            return false;
        }

        childNodes(): TSNode[] {
            return this.node.children.filter(isNotNullish).filter(Definition.isCompatible);
        }

        // directChildren(skipExtras = true): MetaNode[] {
        //     return this.childNodes()
        //         .map(child => MetaNode.tryFrom(child, this.grammar))
        //         .filter(isNotNullish)
        //         .filter(this.extraFilter(skipExtras));
        // }

        children(skipExtras = true): Definition[] {
            return this.childNodes()
                .map(child => this.getOrTryNewNode(child))
                .filter(isNotNullish)
                .filter(this.extraFilter(skipExtras));
        }

        abstract format(): string;
        private getOrTryNewNode(node: TSNode): Definition | undefined {
            return this.queryFile?.getOrTryNew(node) ?? Definition.tryFrom(node, this.grammar);
        }
    }

    export class NamedNode extends AbstractDefinition {
        readonly nodeType = 'named_node';
        readonly isTerminal = true;
        readonly terminality = Terminality.PseudoTerminal;

        private constructor(
            public node: TSNode, //
            readonly _queryFileOrGrammar: QueryFile | QueryGrammar,
            public name: string,
            public supertype?: string
        ) {
            super();
        }

        get isWildcard(): boolean {
            return this.name === '_';
        }

        get isExtra() {
            return (
                this.grammar.extrasNames.has(this.name) || this.grammar.extras.some(rule => rule.matchesTerminalNode(this.node))
            );
        }

        get isRoot(): boolean {
            return this.grammar.getByName(this.name).some(rule => rule.id === 0);
        }

        firstTerminalChildren(skipExtras = true): KindaTerminalDefinition[] {
            for (let child of this.yieldChildren(skipExtras)) {
                if (child.isTerminal) {
                    return child.thisOrFirstTerminalChildren(skipExtras);
                }
            }
            return [];
        }

        static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | QueryGrammar): NamedNode | undefined {
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
        readonly isTerminal = true;
        readonly terminality = Terminality.Terminal;
        private constructor(
            public node: TSNode, //
            readonly _queryFileOrGrammar: QueryFile | QueryGrammar,
            public name: string,
            public isWildcard: boolean
        ) {
            super();
        }

        firstTerminalChildren(skipExtras = true): KindaTerminalDefinition[] {
            return [];
        }

        static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | QueryGrammar): AnonymousNode | undefined {
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
        readonly isTerminal = true;
        readonly nodeType = 'missing_node';
        readonly terminality = Terminality.Terminal; // NOTE this will change later
        private constructor(
            public node: TSNode, //
            readonly _queryFileOrGrammar: QueryFile | QueryGrammar
        ) {
            super();
        }

        firstTerminalChildren(skipExtras = true): KindaTerminalDefinition[] {
            return [];
        }

        static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | QueryGrammar): MissingNode | undefined {
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
        readonly isTerminal = false;
        readonly nodeType = 'list';
        readonly terminality = Terminality.NonTerminal;
        private constructor(
            public node: TSNode, ///
            readonly _queryFileOrGrammar: QueryFile | QueryGrammar
        ) {
            super();
        }

        firstTerminalChildren(skipExtras = false): KindaTerminalDefinition[] {
            return this.children(skipExtras).flatMap(child => child.thisOrFirstTerminalChildren(skipExtras));
        }

        static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | QueryGrammar): List | undefined {
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
        readonly isTerminal = false;
        readonly terminality = Terminality.NonTerminal;

        readonly nodeType = 'grouping';
        private constructor(
            public node: TSNode, ///
            readonly _queryFileOrGrammar: QueryFile | QueryGrammar
        ) {
            super();
        }

        firstTerminalChildren(skipExtras = true): KindaTerminalDefinition[] {
            for (let child of this.yieldChildren(skipExtras)) {
                if (child.isTerminal) {
                    return child.thisOrFirstTerminalChildren(skipExtras);
                }
            }
            return [];
        }

        static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | QueryGrammar): Grouping | undefined {
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
        readonly isTerminal = true;
        readonly terminality = Terminality.PseudoTerminal;

        readonly nodeType = 'field_definition';
        private constructor(
            public node: TSNode, ///
            readonly _queryFileOrGrammar: QueryFile | QueryGrammar,
            public name: string
        ) {
            super();
        }

        firstTerminalChildren(skipExtras = true): KindaTerminalDefinition[] {
            return []; // TODO
        }

        get value(): Definition | undefined {
            return firstOf(this.children());
        }

        // terminalChildren(): MetaNode[] {
        //     return []; // TODO
        // }

        static tryFrom(node: TSNode, queryFileOrGrammar: QueryFile | QueryGrammar): FieldDefinition | undefined {
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
}

export const NamedNode = Definition.NamedNode;
export const AnonymousNode = Definition.AnonymousNode;
export const MissingNode = Definition.MissingNode;
export const List = Definition.List;
export const Grouping = Definition.Grouping;
export const FieldDefinition = Definition.FieldDefinition;

export default Definition;
