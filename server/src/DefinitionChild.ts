import { AnonymousNode, Definition, FieldDefinition, Grouping, List, MissingNode, NamedNode } from './Definition';
import { Grammar } from './Grammar';
import { firstOf } from './itertools';
import { alwaysReturnsTrue } from './junk_drawer';
import { isNotNullish } from './predicates';
import { QueryFile } from './QueryFile';
import { TSNode } from './reexports';
import {
    HasTerminality,
    KindaNonTerminal,
    KindaTerminal,
    NonTerminal,
    PseudoTerminal,
    Terminal,
    Terminality,
} from './Terminality';

export function isAnchor(node: TSNode): boolean {
    return node.type === '.' && node.isNamed;
}



export type DefinitionChild = Definition | DefinitionChild.Anchor;


function isNotExtra(node: DefinitionChild): boolean {
    return !node.isExtra;
}

function isNotAnchor(node: DefinitionChild): node is Definition {
    return !(node instanceof DefinitionChild.Anchor);
}

export type TraversalOptions = {
    skipExtras?: boolean;
    skipAnchors?: boolean;
    ceiling?: Definition;
};

export namespace TraversalOptions {
    export const DEFAULT: TraversalOptions = {
        skipExtras: true,
        skipAnchors: true,
    };
}

export type TraversalFilter = (arg: DefinitionChild) => boolean;
export namespace TraversalFilter {
    export function fromOptions(options: TraversalOptions): TraversalFilter {
        options = { ...TraversalOptions.DEFAULT, ...options };
        let filters: TraversalFilter[] = [];

        options.skipExtras && filters.push(isNotExtra);
        options.skipAnchors && filters.push(isNotAnchor);
        options.ceiling !== undefined && filters.push((arg: DefinitionChild) => options.ceiling!.hasDescendant(arg));

        if (!filters.length) {
            return alwaysReturnsTrue;
        }
        return (arg: DefinitionChild) => filters.every(filter => filter(arg));
    }
}

export abstract class AbstractDefinitionChild extends HasTerminality {
    abstract readonly nodeType: string;
    abstract isTerminal_: boolean;
    abstract readonly terminality: Terminality;
    public abstract node: TSNode;
    abstract readonly _queryFileOrGrammar: Grammar | QueryFile;
    abstract firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    abstract firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];

    isAnchor(): this is DefinitionChild.Anchor {
        return (this as unknown) instanceof DefinitionChild.Anchor;
    }

    isDefinition(): this is Definition {
        return !this.isAnchor();
    }

    get queryFile(): QueryFile | undefined {
        return this._queryFileOrGrammar instanceof QueryFile ? this._queryFileOrGrammar : undefined;
    }

    get grammar(): Grammar {
        let thing = this._queryFileOrGrammar;
        return thing instanceof Grammar ? thing : thing.grammar;
    }

    get id(): number {
        return this.node.id;
    }

    get isExtra() {
        return this.grammar.extras.some(rule => rule.matchesTerminalNode(this.node));
    }

    isLastExtra(ceiling: KindaNonTerminal<Definition>): boolean {
        return this.isExtra && !this.nextKindaTerminals({ skipExtras: true, skipAnchors: true, ceiling }).length;
    }

    get parent(): Definition | undefined {
        return !this.node.parent ? undefined : this.getOrTryNewDefinitionChild(this.node.parent);
    }

    get asArray(): (typeof this)[] {
        return [this];
    }

    *yieldAncestors() {
        let ancestor = this.parent;
        while (ancestor) {
            yield ancestor;
            ancestor = ancestor.parent;
        }
        return;
    }

    hasDescendant(definition: DefinitionChild): boolean {
        for (let ancestor of definition.yieldAncestors()) {
            if (ancestor.id === this.id) {
                return true;
            }
        }
        return false;
    }

    *yieldChildren(options: TraversalOptions = TraversalOptions.DEFAULT) {
        for (let child of this.children(options)) {
            yield child;
        }
        return;
    }

    thisOrKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        let dontSkip = TraversalFilter.fromOptions(options);
        return (
            (dontSkip(this.asDefinitionChild) && this.asDefinitionChild.asKindaTerminal?.asArray) ||
            this.kindaTerminalChildren(options)
        );
    }

    kindaTerminalChildren(options: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
    kindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
    kindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        return this.children(options).flatMap(child => child.thisOrKindaTerminalChildren(options));
    }

    private get asDefinitionChild(): DefinitionChild {
        return this as unknown as DefinitionChild;
    }

    // private get asDefinition(): Definition | undefined {
    //     return (this.isAnchor() ? undefined : (this as unknown)) as Definition | undefined;
    // }

    thisOrFirstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        let dontSkip = TraversalFilter.fromOptions(options);
        return (
            (dontSkip(this.asDefinitionChild) && this.asDefinitionChild.asKindaTerminal?.asArray) ||
            this.firstKindaTerminalChildren(options)
        );
    }

    *yieldPreviousSiblings(options: TraversalOptions = TraversalOptions.DEFAULT) {
        let dontSkip = TraversalFilter.fromOptions(options);
        for (let siblingNode of TSNode.yieldPreviousSiblings(this.node)) {
            let previous = this.getOrTryNewDefinitionChild(siblingNode);
            if (!!previous && dontSkip(previous)) {
                yield previous;
            }
        }
    }

    previousSibling(options: TraversalOptions = TraversalOptions.DEFAULT): Definition | undefined {
        return firstOf(this.yieldPreviousSiblings(options));
    }

    *yieldNextSiblings(options: TraversalOptions = TraversalOptions.DEFAULT) {
        let dontSkip = TraversalFilter.fromOptions(options);
        for (let siblingNode of TSNode.yieldNextSiblings(this.node)) {
            let next = this.getOrTryNewDefinitionChild(siblingNode);
            // let next = MetaNode.tryFrom(siblingNode, this.grammar);
            if (!!next && dontSkip(next)) {
                yield next;
            }
        }
    }

    nextSibling(options: TraversalOptions = TraversalOptions.DEFAULT): Definition | undefined {
        return firstOf(this.yieldNextSiblings(options));
    }

    nextKindaTerminals(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
        let parent = this.parent;
        if (this.node.parent?.type === 'program') {
            return [];
        }
        if (parent?.nodeType === 'list') {
            return parent.nextKindaTerminals(options);
        }

        let next = this.nextSibling(options)?.thisOrFirstKindaTerminalChildren(options) ?? [];
        if (!!next.length) {
            return next;
        }

        return parent?.nextKindaTerminals(options) ?? [];
    }

    childNodes(): TSNode[] {
        return this.node.children.filter(isNotNullish).filter(Definition.isCompatible);
    }

    children(options: TraversalOptions = TraversalOptions.DEFAULT): Definition[] {
        return this.childNodes()
            .map(child => this.getOrTryNewDefinitionChild(child))
            .filter(isNotNullish)
            .filter(TraversalFilter.fromOptions(options));
    }

    private getOrTryNewDefinitionChild(node: TSNode): Definition | undefined {
        return this.queryFile?.getOrTryNew(node) ?? DefinitionChild.tryFrom(node, this.grammar);
    }
}

export namespace DefinitionChild {
    export type NodeType = DefinitionChild['nodeType'];
    const TERMINAL_NODE_TYPES: Terminal<DefinitionChild>['nodeType'][] = ['.', 'anonymous_node', 'missing_node'] as const;
    const PSEUDO_TERMINAL_TYPES: PseudoTerminal<DefinitionChild>['nodeType'][] = ['named_node', 'field_definition'] as const;
    const NON_TERMINAL_NODE_TYPES: NonTerminal<DefinitionChild>['nodeType'][] = ['grouping', 'list'] as const;
    const NODE_TYPES: NodeType[] = [...TERMINAL_NODE_TYPES, ...NON_TERMINAL_NODE_TYPES, ...PSEUDO_TERMINAL_TYPES] as const;

    export function is(arg: any): arg is Definition {
        return arg instanceof AbstractDefinitionChild;
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

    export class Anchor extends AbstractDefinitionChild {
        readonly nodeType = '.';
        readonly terminality = Terminality.Terminal;
        readonly isTerminal_ = true;
        constructor(public node: TSNode, readonly _queryFileOrGrammar: QueryFile | Grammar) {
            super();
        }
        format(): string {
            return '.';
        }
        firstKindaTerminalChildren(options?: TraversalOptions & { skipAnchors: true }): KindaTerminal<Definition>[];
        firstKindaTerminalChildren(options?: TraversalOptions): KindaTerminal<DefinitionChild>[];
        firstKindaTerminalChildren(options: TraversalOptions = TraversalOptions.DEFAULT): KindaTerminal<DefinitionChild>[] {
            return [];
        }
    }
}

// export default Definition;
