import { firstOf } from './itertools';
import { nameOfNamedNode } from './junk_drawer';
import { isNotNullish } from './predicates';
import { TSNode } from './reexports';
import { FieldName } from './typeChecking';
import { ReGrammar } from './untitled';

export type MetaNode = NamedNode | AnonymousNode | MissingNode | List | Grouping | FieldDefinition;

export namespace MetaNode {
    export function tryFrom(node: TSNode, grammar: ReGrammar): MetaNode | undefined {
        switch (node.type) {
            case 'named_node':
                return NamedNode.tryFrom(node, grammar);
            case 'anonymous_node':
                return AnonymousNode.tryFrom(node, grammar);
            case 'missing_node':
                return MissingNode.tryFrom(node, grammar);
            case 'list':
                return List.tryFrom(node, grammar);
            case 'grouping':
                return Grouping.tryFrom(node, grammar);
            case 'field_definition':
                return FieldDefinition.tryFrom(node, grammar);
            default:
                return;
        }
    }

    type NodeType = MetaNode['nodeType'];
    const TERMINAL_NODE_TYPES: NodeType[] = ['named_node', 'anonymous_node', 'missing_node', 'field_definition'] as const;
    const NON_TERMINAL_NODE_TYPES: NodeType[] = ['grouping', 'list'] as const;
    const NODE_TYPES: NodeType[] = [...TERMINAL_NODE_TYPES, ...NON_TERMINAL_NODE_TYPES] as const;
    export function typeIsTerminal(node: TSNode): boolean {
        return TERMINAL_NODE_TYPES.includes(node.type as NodeType);
    }
    export function isCompatible(node: TSNode): boolean {
        return NODE_TYPES.includes(node.type as NodeType);
    }
}

interface IMetaNode {
    node: TSNode;
    readonly nodeType: string;
    grammar: ReGrammar;

    isExtra: boolean;
}
function alwaysReturnsTrue(arg: any): true {
    return true;
}
function isNotExtra(node: MetaNode): boolean {
    return !node.isExtra;
}
abstract class AbstractMetaNode {
    abstract readonly nodeType: string;
    abstract isTerminal: boolean;
    public abstract node: TSNode;
    public abstract grammar: ReGrammar;

    get isExtra() {
        return this.grammar.extras.some(rule => rule.matchesTerminalNode(this.node));
    }

    get parent(): MetaNode | undefined {
        return !this.node.parent ? undefined : MetaNode.tryFrom(this.node.parent, this.grammar);
    }

    // firstTerminalNonExtraChildren(): MetaNode {
    //     return this.firstTerminalChildren().fil
    // }
    private extraFilter(shouldSkip: boolean) {
        return shouldSkip ? isNotExtra : alwaysReturnsTrue;
    }

    *yieldChildren(skipExtras: boolean = true) {
        let dontSkip = this.extraFilter(skipExtras);
        for (let child_ of this.node.children.filter(isNotNullish)) {
            let child = MetaNode.tryFrom(child_, this.grammar);
            if (!!child && dontSkip(child)) {
                yield child;
            }
        }
        return;
    }

    thisOrTerminalChildren(skipExtras: boolean = true): MetaNode[] {
        return this.isTerminal && skipExtras ? [this as unknown as MetaNode] : this.terminalChildren(skipExtras);
    }

    terminalChildren(skipExtras = true): MetaNode[] {
        return this.children()
            .filter(child => child.thisOrTerminalChildren())
            .filter(this.extraFilter(skipExtras));
    }

    abstract firstTerminalChildren(skipExtras: boolean): MetaNode[];

    private get asMetaNode(): MetaNode {
        return this as unknown as MetaNode;
    }

    thisOrFirstTerminalChildren(skipExtras = true): MetaNode[] {
        return this.isTerminal && this.extraFilter(skipExtras)(this.asMetaNode)
            ? [this.asMetaNode]
            : this.firstTerminalChildren(skipExtras);
    }

    *yieldNextSiblings(skipExtras: boolean = true) {
        let dontSkip = this.extraFilter(skipExtras);
        for (let siblingNode of TSNode.yieldNextSiblings(this.node)) {
            let next = MetaNode.tryFrom(siblingNode, this.grammar);
            if (!!next && dontSkip(next)) {
                yield next;
            }
        }
    }

    nextSibling(skipExtras: boolean = true): MetaNode | undefined {
        return firstOf(this.yieldNextSiblings(skipExtras));
    }

    // nextNonExtraTerminals(): MetaNode[] {
    //     let parent = this.parent;
    //     if (parent?.nodeType === 'list') {
    //         return parent.nextNonExtraTerminals();
    //     }
    //     let nextSibling = this.nextSibling();
    //     let nexts: MetaNode[] = [];
    //     if (nextSibling) {
    //         if (nextSibling?.isExtra) {
    //             nexts = nextSibling.nextSibling()?.nextNonExtraTerminals() ?? [];
    //         } else {
    //             nexts = nextSibling.nextNonExtraTerminals();
    //         }
    //     }
    //     let next = this.nextSibling()?.thisOrFirstTerminalChildren() ?? [];
    //     if (!!next.length) {
    //         return next;
    //     }
    //     return parent?.nextTerminals() ?? [];
    // }

    nextTerminals(skipExtras = true): MetaNode[] {
        let parent = this.parent;
        if (parent?.nodeType === 'list') {
            return parent.nextTerminals(skipExtras);
        }
        let next = this.nextSibling(skipExtras)?.thisOrFirstTerminalChildren(skipExtras) ?? [];
        if (!!next.length) {
            return next;
        }
        return parent?.nextTerminals(skipExtras) ?? [];
    }

    childNodes(): TSNode[] {
        return this.node.children.filter(isNotNullish).filter(MetaNode.isCompatible);
    }

    children(skipExtras = true): MetaNode[] {
        return this.childNodes()
            .map(child => MetaNode.tryFrom(child, this.grammar))
            .filter(isNotNullish)
            .filter(this.extraFilter(skipExtras));
    }
}

export class NamedNode extends AbstractMetaNode implements IMetaNode {
    readonly nodeType = 'named_node';
    readonly isTerminal = true;
    private constructor(
        public node: TSNode, //
        public grammar: ReGrammar,
        public name: string,
        public supertype?: string
    ) {
        super();
    }

    get isExtra() {
        return this.grammar.extrasNames.has(this.name) || this.grammar.extras.some(rule => rule.matchesTerminalNode(this.node));
    }

    firstTerminalChildren(skipExtras = true): MetaNode[] {
        for (let child of this.yieldChildren(skipExtras)) {
            if (child.isTerminal) {
                return child.thisOrFirstTerminalChildren(skipExtras);
            }
        }
        return [];
    }

    static tryFrom(node: TSNode, grammar: ReGrammar): NamedNode | undefined {
        if (node.type !== 'named_node') {
            return;
        }
        let name = nameOfNamedNode(node);
        if (!name) {
            return;
        }
        let supertype = node.childForFieldName('supertype')?.text;
        return new NamedNode(node, grammar, name, supertype);
    }
}

export class AnonymousNode extends AbstractMetaNode implements IMetaNode {
    readonly nodeType = 'anonymous_node';
    readonly isTerminal = true;
    private constructor(
        public node: TSNode, //
        public grammar: ReGrammar,
        public name: string,
        public isWildcard: boolean
    ) {
        super();
    }

    firstTerminalChildren(skipExtras = true): MetaNode[] {
        return [];
    }

    static tryFrom(node: TSNode, grammar: ReGrammar): AnonymousNode | undefined {
        if (node.type !== 'anonymous_node') {
            return undefined;
        }
        let nameAndWildcard = TSNode.nameOfAnonymousNode(node);
        if (!nameAndWildcard) {
            return;
        }
        let [name, isWildcard] = nameAndWildcard;
        return new AnonymousNode(node, grammar, name, isWildcard);
    }
}

export class MissingNode extends AbstractMetaNode implements IMetaNode {
    readonly isTerminal = true;
    readonly nodeType = 'missing_node';
    private constructor(
        public node: TSNode, //
        public grammar: ReGrammar
    ) {
        super();
    }

    firstTerminalChildren(skipExtras = true): MetaNode[] {
        return [];
    }

    static tryFrom(node: TSNode, grammar: ReGrammar): MissingNode | undefined {
        if (node.type !== 'missing_node') {
            return undefined;
        }
        return new MissingNode(node, grammar);
    }
}

export class List extends AbstractMetaNode implements IMetaNode {
    readonly isTerminal = false;
    readonly nodeType = 'list';
    private constructor(
        public node: TSNode, ///
        public grammar: ReGrammar
    ) {
        super();
    }

    firstTerminalChildren(skipExtras = false): MetaNode[] {
        return this.children(skipExtras).flatMap(child => child.thisOrFirstTerminalChildren(skipExtras));
    }

    static tryFrom(node: TSNode, grammar: ReGrammar): List | undefined {
        if (node.type !== 'list') {
            return;
        }
        return new List(node, grammar);
    }
}

export class Grouping extends AbstractMetaNode implements IMetaNode {
    readonly isTerminal = false;

    readonly nodeType = 'grouping';
    private constructor(
        public node: TSNode, ///
        public grammar: ReGrammar
    ) {
        super();
    }

    firstTerminalChildren(skipExtras = true): MetaNode[] {
        for (let child of this.yieldChildren(skipExtras)) {
            if (child.isTerminal) {
                return child.thisOrFirstTerminalChildren(skipExtras);
            }
        }
        return [];
    }

    static tryFrom(node: TSNode, grammar: ReGrammar): Grouping | undefined {
        if (node.type !== 'grouping') {
            return;
        }
        return new Grouping(node, grammar);
    }
}

export class FieldDefinition extends AbstractMetaNode implements IMetaNode {
    readonly isTerminal = false;

    readonly nodeType = 'field_definition';
    private constructor(
        public node: TSNode, ///
        public grammar: ReGrammar,
        public name: string
    ) {
        super();
    }

    firstTerminalChildren(skipExtras = true): MetaNode[] {
        return []; // TODO
    }

    // terminalChildren(): MetaNode[] {
    //     return []; // TODO
    // }

    static tryFrom(node: TSNode, grammar: ReGrammar): FieldDefinition | undefined {
        if (node.type !== 'field_definition') {
            return;
        }
        let name = FieldName.fromNode(node);
        if (!name) {
            return;
        }
        return new FieldDefinition(node, grammar, name);
    }
}
