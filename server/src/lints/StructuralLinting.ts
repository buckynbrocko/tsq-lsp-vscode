// import { Predicate } from '../formatting/Formattable';
import { Dict } from '../Dict';
import { Identifier, nameOfNamedNode } from '../junk_drawer';
import { isDefined, isNotNullish, isType } from '../predicates';
import { TSNode } from '../reexports';
import { FieldName } from '../typeChecking';
import { Grammar, Rule, TSQGrammar } from '../untitled';

type ToDo<T = any> = any;
export type StructuralDiagnostic = ToDo;

/**
 * Structural correctness:
 *      - must be in non-sequential order
 *          - nodes can be omitted but not rearranged
 *          - unless specified with an anchor
 */

type Program = Definition[];

export type DefinitionChild = Definition | NegatedField | '.';
export type Definition = AnonymousNode | FieldDefinition | Grouping | List | MissingNode | NamedNode | Predicate;
export type Pattern = Definition | NegatedField;
export type PseudoTerminalChild = AnonymousNode | FieldDefinition | MissingNode | NamedNode | NegatedField;
export type Branching = Grouping | List | NamedNode;
// export type NonContextualDefinition = AnonymousNode | FieldDefinition | Grouping | List | MissingNode | NamedNode | Predicate;

type NodeMap = Dict<number, TSNode>;
type NodeRoutes = Dict<number, Set<number>>;


export namespace NodeMap {
    export function fromNode(node_: TSNode): NodeMap {
        let map: NodeMap = new Dict();
        let queue: TSNode[] = [node_];
        for (let node of queue) {
            if (TSNode.isDefinitionChild(node_)) {
                continue;
            }
            map.set(node.id, node);
            queue.push(...node.children.filter(isNotNullish));
        }
        return map;
    }
}


// function nextImmediateDefinitions(node: TSNode): Set<number> {
//     // let next = new Set<number>();
//     if (!TSNode.isDefinitionChild(node)) {
//         return new Set<number>();
//     }
//     switch (node.parent?.type) {
//         case 'list':
//             return nextImmediateDefinitions(node.parent);
//         case 'grouping':
//             let next = node.nextSibling ?? undefined;
//             while (next) {
//                 if (TSNode.isDefinitionChild(next)) {
//                     return new Set([next.id]);
//                 }
//             }
//             return nextImmediateDefinitions(node.parent);
//     }
//     switch (node.type) {
//         case 'named_node':
//             break;
//         case 'list':
//             break;
//         case 'grouping':
//             break;
//         case 'anonymous_node':
//             break;
//         case 'named_node':
//             break;
//     }
//     return next;
// }

export class MaxIterations {
    count: number = 0;
    constructor(public max: number) {
        if (max < this.count) {
            throw 'max < this.count';
        }
    }

    get ok(): boolean {
        if (this.count < this.max) {
            this.count += 1;
            return true;
        }
        return false;
    }
}

export namespace DefinitionChild {
    export function directChildren(definition: DefinitionChild): DefinitionChild[] {
        if (definition === '.') {
            return [];
        }
        switch (definition.type) {
            case 'AnonymousNode':
            case 'MissingNode':
            case 'Predicate':
            case 'NegatedField':
                return [];
            case 'FieldDefinition':
                return [definition.value];
            case 'Grouping':
            case 'List':
                return definition.members;
            case 'NamedNode':
                return definition.children;
        }
    }

    export function* traverseBreadthFirst(definition: DefinitionChild) {
        let queue: DefinitionChild[] = [];
        let current: DefinitionChild | undefined = definition;
        const MAX_ITERATIONS = 1000;
        let count = 0;
        while (!!current) {
            yield current;
            queue.push(...DefinitionChild.directChildren(definition));
            current = queue.shift();
            count += 1;
        }
    }

    export function* breadthFirstParentChildPairs(
        definition: DefinitionChild
    ): Generator<[Definition, DefinitionChild], undefined, unknown> {
        if (definition === '.') {
            return undefined;
        }
        switch (definition.type) {
            case 'AnonymousNode':
            case 'MissingNode':
            case 'Predicate':
            case 'NegatedField':
                return undefined;
            case 'FieldDefinition':
            case 'Grouping':
            case 'List':
            case 'NamedNode':
                let children = directChildren(definition);
                for (let child of children) {
                    yield [definition, child];
                }
            // for (let child of children) {
            //     yield* breadthFirstParentChildPairs(child);
            // }
        }
        return undefined;
    }

    export function isTerminal(child: DefinitionChild) {
        if (child === '.') {
            return true;
        }
        switch (child.type) {
            case 'AnonymousNode':
            case 'NamedNode':
            case 'NegatedField':
            case 'MissingNode':
                return true;
            case 'FieldDefinition':
            case 'Grouping':
            case 'List':
            case 'Predicate':
                return false;
        }
    }
}

export function isNotAnchor<T extends Definition | NegatedField>(value: T | '.'): value is T extends '.' ? never : T {
    return value !== '.';
}

export function isDefinitionOrNegatedField(value: Pattern | '.'): value is Exclude<Pattern, '.'> {
    return value !== '.';
}

export function isNotNegatedField<T extends Definition | NegatedField>(definition: Definition | NegatedField): definition is T {
    return definition.type !== 'NegatedField';
}
// function classifyDefinitionOrAn

export type Quantifier = '?' | '+' | '*';
export type Quantifiable = { quantifier?: Quantifier };

function flattenDefinition(definition: Definition): (AnonymousNode | FieldDefinition | MissingNode | NamedNode)[] {
    switch (definition.type) {
        case 'AnonymousNode':
        case 'FieldDefinition':
        case 'MissingNode':
        case 'NamedNode':
            return [definition];
        case 'Grouping':
            return definition.members.filter(isNotAnchor).flatMap(flattenDefinition);
        case 'List':
            return definition.members.flatMap(flattenDefinition);
        case 'Predicate':
            break;
    }
    return [];
}

export function flattenChildIdentity(
    child: DefinitionChild
): (AnonymousNode | FieldDefinition | MissingNode | NamedNode | NegatedField)[] {
    if (child === '.') {
        return [];
    }
    switch (child.type) {
        case 'AnonymousNode':
        case 'FieldDefinition':
        case 'NamedNode':
        case 'NegatedField':
            return [child];
        case 'Grouping':
        case 'List':
            return child.members.flatMap(flattenChildIdentity);
        case 'MissingNode':
            return []; // TODO
        case 'Predicate':
            return []; // TODO
    }
}

export type PatternPath = number[];
export namespace PatternPath {
    export function toString(path: PatternPath): string {
        return path.join('-');
    }

    export function fromString(string_: string): PatternPath | undefined {
        try {
            return string_.split('-').map(Number.parseInt);
        } catch (e) {}
        return undefined;
    }
}

export namespace Pattern {
    export function format(arg: Pattern): string {
        switch (arg.type) {
            case 'AnonymousNode':
                return arg.isWildcard ? '_' : `"${arg.name}"`;
            case 'FieldDefinition':
                return `${arg.name}: ...`;
            case 'Grouping':
            case 'List':
            case 'MissingNode':
                return 'MISSING';
            case 'NamedNode':
                return arg.supertype ? `(${arg.supertype}/${arg.name})` : `(${arg.name})`;
            case 'Predicate':
                return `(#${arg.name}${arg.predicateType} ...)`;
            case 'NegatedField':
                return `!${arg.name}`;
        }
    }
    export function* _index(pattern: Pattern, parentIndex?: number) {
        let index = 0;
    }

    export function* iterate(pattern: Pattern | '.'): Generator<DefinitionChild, undefined> {
        yield pattern;
        if (pattern === '.') {
            return;
        }
        switch (pattern.type) {
            case 'Predicate':
            case 'AnonymousNode':
            case 'MissingNode':
            case 'NegatedField':
                return;
            case 'FieldDefinition':
                yield pattern;
                yield* iterate(pattern.value);
                break;
            case 'Grouping':
            case 'List':
                for (let member of pattern.members.map(iterate)) {
                    yield* member;
                }
                break;
            case 'NamedNode':
                for (let child of pattern.children.map(iterate)) {
                    yield* child;
                }
                break;
        }
        return;
    }

    export function isQuantifiable(pattern: Pattern | '.'): pattern is Extract<Pattern, Quantifiable> {
        if (pattern === '.') {
            return false;
        }
        switch (pattern.type) {
            case 'AnonymousNode':
            case 'Grouping':
            case 'List':
            case 'MissingNode':
            case 'FieldDefinition':
            case 'NamedNode':
                return true;
            case 'Predicate':
            case 'NegatedField':
                return false;
        }
    }

    export function doubleIndex(pattern: Pattern) {}

    export function* _doubleIndex(pattern: Pattern, current: [number, PatternPath] = [0, [0]]) {
        let [index, path] = current;

        switch (pattern.type) {
        }
    }

    export function sizeOf(pattern: Pattern | '.'): number {
        if (pattern === '.') {
            return 1;
        }
        switch (pattern.type) {
            case 'AnonymousNode':
            case 'Predicate':
            case 'NegatedField':
            case 'MissingNode':
                return 1;
            case 'FieldDefinition':
                return 1 + sizeOf(pattern.value);
            case 'Grouping':
            case 'List':
                return 1 + pattern.members.map(sizeOf).reduce((a, b) => a + b);
            case 'NamedNode':
                return 1 + pattern.children.map(sizeOf).reduce((a, b) => a + b);
        }
    }

    export function indexInto(pattern: Pattern, index: number): Pattern | '.' | undefined {
        switch (pattern.type) {
            case 'AnonymousNode':
            case 'MissingNode':
            case 'Predicate':
            case 'NegatedField':
                if (index === 0) {
                    return pattern;
                }
                break;
            case 'FieldDefinition':
                if (index === 0) {
                    return pattern.value;
                }
                break;
            case 'Grouping':
            case 'List':
                if (index < pattern.members.length) {
                    return pattern.members[index];
                }
                console.error(`Out-of-bounds index for pattern ${pattern.type}(length ${pattern.members.length}): '${index}'`);
                return;
            case 'NamedNode':
                if (index < pattern.children.length) {
                    return pattern.children[index];
                }
                console.error(`Out-of-bounds index for pattern ${pattern.type}(length ${pattern.children.length}): '${index}'`);
                return;
        }
        console.error(`Invalid index for pattern ${pattern.type}: '${index}'`);
        return undefined;
    }

    export function indexByPath(pattern: Pattern, path: PatternPath): Pattern | '.' | undefined {
        let current: Pattern | '.' | undefined = pattern;
        for (let index of path) {
            if (current === '.') {
                current = undefined;
                break;
            } else if (!current) {
                break;
            }
            current = indexInto(current, index);
        }
        return current;
    }

    export function hasMembers(pattern: Pattern): pattern is List | Grouping {
        return pattern.type === 'List' || pattern.type === 'Grouping';
    }
}
class IDGenerator {
    id: number = -1;
    next(): number {
        this.id += 1;
        return this.id;
    }
}

// index
// path
// rule
// immediate-next

export class PatternMachine {
    entries: DefinitionChild[] = [];
    ChildToParent: number[] = [];
    ParentToChildren: number[][] = [];
    IndexToPath: PatternPath[] = [];
    PathToIndex: Dict<string, number> = new Dict();
    terminals: Set<number> = new Set();
    listIndices: Set<number> = new Set();
    constructor(private pattern: Pattern) {
        this.entries = [pattern];
        if (pattern.type === 'List') {
            this.listIndices.add(0);
        }

        let queueIndex: number = 1;
        let parentIndex: number = 0;
        let current: DefinitionChild;
        let queue: [number, DefinitionChild][] = DefinitionChild.directChildren(pattern).map(child => [0, child]);
        let currentPair: [number, DefinitionChild] | undefined = queue.shift();
        const LIMIT = new MaxIterations(1000);
        while (!!currentPair && LIMIT.ok) {
            [parentIndex, current] = currentPair;
            this.entries.push(current);
            this.ChildToParent[queueIndex] = parentIndex;
            if (current !== '.' && current.type === 'List') {
                this.listIndices.add(queueIndex);
            }

            if (!!this.ParentToChildren.at(parentIndex)) {
                this.ParentToChildren.at(parentIndex)!.push(queueIndex);
            } else {
                this.ParentToChildren[parentIndex] = [queueIndex];
            }

            queue.push(
                ...DefinitionChild.directChildren(current).map(child => [queueIndex, child] satisfies [number, DefinitionChild])
            );
            queueIndex += 1;
            currentPair = queue.shift();
        }
    }

    get(index: number | undefined): DefinitionChild | undefined {
        return index === undefined ? undefined : this.entries.at(index);
    }

    getParentIndex(index: number | undefined): number | undefined {
        return index === undefined ? undefined : this.ChildToParent.at(index);
    }

    previousAncestorIndex(index: number | undefined): number | undefined {
        let parentIndex: number | undefined = this.getParentIndex(index);
        let previous: number | undefined;
        let MAX_ITERATIONS = new MaxIterations(1000);
        while (parentIndex !== undefined && MAX_ITERATIONS.ok) {
            previous = this.previousSiblingIndex(parentIndex);
            if (isDefined(previous)) {
                return previous;
            }
            parentIndex = this.getParentIndex(parentIndex);
        }
        return undefined;
    }

    nextAncestorIndex(index: number | undefined): number | undefined {
        let parentIndex: number | undefined = this.getParentIndex(index);
        let next: number | undefined;
        let MAX_ITERATIONS = new MaxIterations(1000);
        while (parentIndex !== undefined && MAX_ITERATIONS.ok) {
            next = this.nextSiblingIndex(parentIndex);
            if (isDefined(next)) {
                return next;
            }
            parentIndex = this.getParentIndex(parentIndex);
        }
        return undefined;
    }

    getChildrenIndices(index: number | undefined): number[] {
        return index === undefined ? [] : this.ParentToChildren.at(index) ?? [];
    }

    getSiblingsIndices(index: number | undefined): number[] {
        let parentIndex = this.getParentIndex(index);

        return parentIndex === undefined ? [] : this.getChildrenIndices(parentIndex);
    }

    getFirstChildIndex(index: number | undefined): number | undefined {
        return this.getChildrenIndices(index).at(0);
    }

    previousSiblingIndex(index: number | undefined): number | undefined {
        if (index === undefined) {
            return;
        }
        let siblings = this.getSiblingsIndices(index);
        let place = siblings.indexOf(index);
        return place < 1 ? undefined : siblings.at(place - 1);
    }

    nextIndex(index: number | undefined): number | undefined {
        const firstChild = this.getFirstChildIndex(index);
        if (isDefined(firstChild)) {
            return firstChild;
        }
        const nextSibling = this.nextSiblingIndex(index);
        if (isDefined(nextSibling)) {
            return nextSibling;
        }
        return this.nextAncestorIndex(index);
    }

    nextTerminalIndices(index: number | undefined): number[] {
        let indices: number[] = [];
        let next: number | undefined = this.nextIndex(index);
        let MAX_ITERATIONS = new MaxIterations(1000);
        while (next !== undefined && MAX_ITERATIONS.ok) {
            if (this.getChildrenIndices(next).length) {
            }
        }
        return indices;
    }

    nextSiblingIndex(index: number | undefined): number | undefined {
        if (index === undefined) {
            return;
        }
        let siblings = this.getSiblingsIndices(index);
        let place = siblings.indexOf(index);
        return place === -1 ? undefined : siblings.at(place + 1);
    }

    getByIndex(index: number): [DefinitionChild, PatternPath] | undefined {
        let child = this.entries.at(index);
        let path = this.IndexToPath.at(index);
        if (!!child && !!path) {
            return [child, path];
        }
        return undefined;
    }

    getIndexByPath(path: PatternPath): number | undefined {
        return this.PathToIndex.get(PatternPath.toString(path));
    }

    getPathByIndex(index: number): PatternPath | undefined {
        return this.IndexToPath.at(index);
    }

    getDouble(arg: number | PatternPath): [number, PatternPath] | undefined {
        let id: number | undefined;
        let path: PatternPath | undefined;
        if (!Array.isArray(arg)) {
            id = arg;
            path = this.getPathByIndex(id);
        } else {
            path = arg;
            id = this.getIndexByPath(path);
        }
        if (!id || !path) {
            return;
        }
        return [id, path];
    }

    getByPath(path: PatternPath): [DefinitionChild, number] | undefined {
        let index = this.PathToIndex.get(PatternPath.toString(path));
        if (!index) {
            return;
        }
        let child = this.entries.at(index);
        if (!child) {
            return;
        }
        return [child, index];
    }

    parentTriple(arg: number | PatternPath): [DefinitionChild, number, PatternPath] | undefined {
        if (arg === 0) {
            return;
        }

        let path = Array.isArray(arg) ? arg : this.getPathByIndex(arg);
        if (!path || path.length < 2) {
            return;
        }
        let parentPath = path.slice(0, -1);

        let parentID: number | undefined = this.getIndexByPath(parentPath);
        if (parentID === undefined) {
            return;
        }

        let parent: DefinitionChild | undefined = this.entries.at(parentID);
        if (!parent) {
            return;
        }

        return [parent, parentID, parentPath];
    }

    parentPath(arg0: number | PatternPath): PatternPath | undefined {
        if (arg0 === 0) {
            return;
        }
        let path: PatternPath | undefined = Array.isArray(arg0) ? arg0 : this.IndexToPath.at(arg0);
        if (!path || path.length <= 1) {
            return;
        }
        return path.slice(0, -1);
    }
    // parentIndex(arg0: number | PatternPath): number | undefined {
    //     let parentPath = this.parentPath(arg0);
    //     return !parentPath ? undefined : this.PathToIndex.get(PatternPath.toString(parentPath));
    // }
}
// index -> rule
//

export type AnonymousNode = Quantifiable & {
    type: 'AnonymousNode';
    // name: '_' | string;
} & ({ isWildcard: true; name: '_' } | { isWildcard: false; name: string });

export type FieldDefinition = {
    type: 'FieldDefinition';
    name: string;
    value: Definition;
};

export type NegatedField = {
    type: 'NegatedField';
    name: string;
};

export type Grouping = Quantifiable & {
    type: 'Grouping';
    members: (Definition | '.')[];
};

export type List = Quantifiable & {
    type: 'List';
    members: Definition[];
};

export type MissingNode = {
    type: 'MissingNode';
    name: ToDo<string>; // NOTE could be identifier or string - will mess with later
};

export type NamedNode = Quantifiable & {
    type: 'NamedNode';
    supertype?: string;
    name: string;
    children: (Definition | NegatedField | '.')[];
    // quantifier?: Quantifier;
};

export type Predicate = {
    type: 'Predicate';
    predicateType: '!' | '?';
    name: string;
    arguments?: ToDo<'arguments'>[]; // TODO
};

function definitionChildren(node: TSNode): TSNode[] {
    return node.namedChildren.filter(isNotNullish).filter(isDefitionNode);
}

function definitionOrAnchorChildren(node: TSNode): TSNode[] {
    return node.namedChildren.filter(isNotNullish).filter(isDefitionOrAnchorNode);
}

const isDefitionNode = isType('anonymous_node', 'field_definition', 'grouping', 'list', 'named_node', 'predicate');
const isDefitionOrAnchorNode = isType('anonymous_node', 'field_definition', 'grouping', 'list', 'named_node', 'predicate', '.');

function analyzeProgramNode(node: TSNode, grammar: TSQGrammar): StructuralDiagnostic[] {
    return definitionChildren(node).flatMap(child => analyzeDefinition(child, grammar));
}

function analyzeDefinition(definition: TSNode, grammar: TSQGrammar): StructuralDiagnostic[] {
    let diagnostics: StructuralDiagnostic[] = [];
    switch (definition.type) {
        case 'named_node':
            let name = nameOfNamedNode(definition);
            let rule = grammar.resolveRuleFor(name);
            if (!name || !rule) {
                if (!!name) {
                    diagnostics.push(`No rule named '${name}'`);
                }
                let children = definitionChildren(definition);
                diagnostics.push(children.flatMap(child => analyzeDefinition(child, grammar)));
                break;
            }
            let children = definitionOrAnchorChildren(definition);
            diagnostics.push(analyzeNamedNodeChildrenWithRule(name, children, rule, grammar));

            break;
        case 'anonymous_node':
            break;
        case 'missing_node':
            break;
        case 'grouping':
            break;
        case 'predicate':
            break;
        case 'list':
            break;
        case 'field_definition':
            break;
    }
    return diagnostics;
}

function analyzeNamedNode(node: TSNode, grammar: TSQGrammar): StructuralDiagnostic[] {
    let diagnostics: StructuralDiagnostic[] = [];
    let name = nameOfNamedNode(node);
    let rule = grammar.resolveRuleFor(name);
    if (!!name && !!rule) {
        let children = definitionOrAnchorChildren(node);
        diagnostics.push(analyzeNamedNodeChildrenWithRule(name, children, rule, grammar));
    } else {
        if (!!name) {
            diagnostics.push(`No rule named '${name}'`);
        }
        let children = definitionChildren(node);
        diagnostics.push(children.flatMap(child => analyzeDefinition(child, grammar)));
    }
    return diagnostics;
}

function NamedNodeWithRule(name: string, node: TSNode, rule: Rule, grammar: TSQGrammar): StructuralDiagnostic[] {
    let diagnostics: StructuralDiagnostic[] = [];
    switch (rule.type) {
        case 'PATTERN':
            return [];
        case 'BLANK':
        case 'STRING':
        case 'FIELD':
            console.warn(`Assumed impossible pattern found: named_node rule '${name}' has type "${rule.type}"`);
        case 'SYMBOL':
        case 'SEQ':
        case 'CHOICE':
        case 'ALIAS':
        case 'REPEAT':
        case 'RESERVED':
        case 'TOKEN':
        case 'IMMEDIATE_TOKEN':
        case 'PREC':
        case 'PREC_LEFT':
        case 'PREC_RIGHT':
        case 'PREC_DYNAMIC':
    }
    return diagnostics;
}

function analyzeNamedNodeChildrenWithRule(
    name: string,
    children: TSNode[],
    rule: Rule,
    grammar: TSQGrammar
): StructuralDiagnostic[] {
    let diagnostics: StructuralDiagnostic = [];
    switch (rule.type) {
        // case 'BLANK':
        // case 'STRING':
        // case 'FIELD':
        case 'PATTERN':
            return [];
        case 'SYMBOL':
        case 'SEQ':
        case 'CHOICE':
        case 'ALIAS':
        case 'REPEAT':
        case 'RESERVED':
        case 'TOKEN':
        case 'IMMEDIATE_TOKEN':
        case 'PREC':
        case 'PREC_LEFT':
        case 'PREC_RIGHT':
        case 'PREC_DYNAMIC':
    }
    return diagnostics;
}

function analyzeChildrenWithSequence(children: TSNode[], sequence: Rule.Sequence, grammar: TSQGrammar): StructuralDiagnostic[] {
    return []; // TODO
}

function analyzeChildWithChoice(child: TSNode, choice: Rule.Choice, grammar: TSQGrammar): StructuralDiagnostic[] {
    for (let member of choice.members) {
        switch (member.type) {
            // case 'CHOICE':
            case 'SYMBOL':
                break;
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SEQ':
            case 'ALIAS':
            case 'REPEAT':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
        }
    }
    return []; // TODO
}

function nodeMatchesRule(node: TSNode, rule: Rule, grammar: TSQGrammar): boolean {
    switch (rule.type) {
        case 'BLANK':
            return false;
        case 'STRING':
        case 'PATTERN':
            return nodeMatchesStringOrPatternRule(node, rule);
        case 'SYMBOL':
            return nodeMatchesSymbolRule(node, rule, grammar);
        case 'SEQ':
        case 'CHOICE':
            return rule.members.some(member => nodeMatchesRule(node, member, grammar));
        case 'ALIAS':
            return nodeMatchesAliasRule(node, rule, grammar);
        case 'FIELD':
            return nodeMatchesFieldRule(node, rule, grammar);
        case 'REPEAT':
        case 'REPEAT1':
        case 'RESERVED':
        case 'TOKEN':
        case 'IMMEDIATE_TOKEN':
        case 'PREC':
        case 'PREC_LEFT':
        case 'PREC_RIGHT':
        case 'PREC_DYNAMIC':
            return nodeMatchesRule(node, rule.content, grammar);
    }
}

function nodeMatchesStringOrPatternRule(node: TSNode, rule: Rule.String | Rule.Pattern): boolean {
    if (node.type !== 'anonymous_node') {
        return false;
    }
    let name = node.childForFieldName('name');
    if (!name) {
        return false;
    }
    if (name.type === '_') {
        return true;
    }
    if (name.type !== 'string') {
        return false;
    }
    let stringContents: string = name.firstNamedChild?.text ?? '';
    return rule.type === 'STRING' ? stringContents === rule.value : new RegExp(rule.value).test(stringContents);
}

function nodeMatchesSymbolRule(node: TSNode, rule: Rule.Symbol, grammar: TSQGrammar): boolean {
    let name = nameOfNamedNode(node);
    if (!name) {
        return false;
    }

    if (!grammar.ruleIsHidden(rule)) {
    }

    let rule_: Rule | undefined = grammar.ruleFor(rule.name);
    if (!rule_) {
        console.error(`failed to find SYMBOL rule "${rule.name}"`);
        return false; // ???
    }
    return nodeMatchesRule(node, rule, grammar);
}
function nodeMatchesAliasRule(node: TSNode, rule: Rule.Alias, grammar: TSQGrammar): boolean {
    return nodeMatchesRule(node, rule.content, grammar); //? Is this any different?
}

function nodeMatchesFieldRule(node: TSNode, rule: Rule.Field, grammar: TSQGrammar): boolean {
    return false;
}

function lintNode(node: TSNode, grammar: TSQGrammar): any[] {
    let diagnostics: any[] = [];
    if (!isDefitionNode(node) && node.type !== 'program') {
        return diagnostics;
    }
    const rule = grammar.ruleFor(node);
    if (!rule) {
        diagnostics.push(`No rule named ${node.type}`);
        diagnostics.push(node.children.filter(isNotNullish).flatMap(child => lintNode(child, grammar)));
    } else {
        diagnostics.push(evaluateNodeWithRule(node, rule, grammar));
    }

    return diagnostics;
}

function evaluateNodeWithRule(node: TSNode, rule: Rule, grammar: TSQGrammar): any[] {
    return []; // TODO
}

function lintNamedNode(node: TSNode, grammar: TSQGrammar): any[] {
    let diagnostics: any[] = [];
    let nameNode = node.childForFieldName('name');
    const name: string | undefined = Identifier.ofNode(node)?.text;

    const rule = Rule.withName(name, grammar.grammar);

    if (!rule && name !== '_') {
        diagnostics.push(`unrecognized node type "${name}"`);
        diagnostics.push(node.children.filter(isNotNullish).flatMap(child => lintNode(node, grammar)));
        return diagnostics;
    }

    switch (rule?.type) {
        case 'SEQ':
            let children = definitionChildren(node);
            for (let child of children) {
            }
            break;
        case undefined:
            break;
        case 'BLANK':
        case 'STRING':
        case 'PATTERN':
        case 'SYMBOL':
        case 'CHOICE':
        case 'ALIAS':
        case 'REPEAT':
        case 'RESERVED':
        case 'TOKEN':
        case 'IMMEDIATE_TOKEN':
        case 'FIELD':
        case 'PREC':
        case 'PREC_LEFT':
        case 'PREC_RIGHT':
        case 'PREC_DYNAMIC':
    }

    return diagnostics;
}

function definitionMatchesRule(definition: TSNode, rule: Rule, grammar: Grammar): boolean {
    if (definition.type === 'list') {
        return definitionChildren(definition).some(child => definitionMatchesRule(child, rule, grammar));
    }
    switch (rule.type) {
        case 'PATTERN':
            return false; // TODO
        case 'ALIAS':
            return false; // TODO
        case 'RESERVED':
            return false; // TODO
        case 'BLANK':
            return false;
        case 'STRING':
            if (definition.type !== 'anonymous_node') {
                return false;
            }
            let name = definition.childForFieldName('name');
            if (!name) {
                return false;
            }
            if (name.type === '_') {
                return true;
            }
            if (name.type !== 'string') {
                return false;
            }
            let stringContents: string = name.firstNamedChild?.text ?? '';
            return stringContents === rule.value;
        case 'SYMBOL':
            return !(rule.name in grammar.rules)
                ? false
                : definitionMatchesRule(definition, grammar.rules[rule.name]!, grammar);
        case 'SEQ':
        case 'CHOICE':
            return rule.members.some(member => definitionMatchesRule(definition, member, grammar));
        case 'REPEAT':
        case 'TOKEN':
        case 'IMMEDIATE_TOKEN':
        case 'PREC':
        case 'PREC_LEFT':
        case 'PREC_RIGHT':
        case 'PREC_DYNAMIC':
            return definitionMatchesRule(definition, rule.content, grammar);
        case 'FIELD':
            if (definition.type !== 'field_definition' && definition.type !== 'negated_field') {
                return false;
            }
            if (definition.type === 'field_definition') {
                const fieldName = FieldName.fromNode(definition);
                if (!fieldName) {
                    return false;
                }
                const value = definitionChildren(definition).at(0);
                return !!value && definitionMatchesRule(value, rule.content, grammar);
            } else {
                // negated_field
                //TODO
            }
    }
    return false; // TODO
}

function mcguffinSequence(sequence: any[]): any[] {
    let diagnostics: any[] = [];

    return diagnostics;
}

function mcguffinDefinition(definition: Definition, grammar: TSQGrammar): StructuralDiagnostic[] {
    let diagnostics: StructuralDiagnostic[] = [];
    switch (definition.type) {
        case 'AnonymousNode':
            if (!definition.isWildcard && grammar.hasLiteral(definition.name)) {
                diagnostics.push(`Unrecognized literal "${definition.name}"`);
            }
            break;
        case 'FieldDefinition':
        case 'Grouping':
        case 'List':
        case 'MissingNode':
            break; // TODO
        case 'NamedNode':
            const rule = grammar.ruleFor(definition.name);
            if (!rule) {
                diagnostics.push(`Unrecognized named_node "${definition.name}"`);
                break;
            }

            break;
        case 'Predicate':
    }
    return diagnostics;
}

function recognizeDefinitions(grammar: TSQGrammar, definitions: Pattern[]): StructuralDiagnostic[] {
    return (
        definitions
            .filter(isNotAnchor)
            // .filter(definition => grammar.hasDefinition(definition))
            .map(definition => {
                `Unrecognized ${definition.type}` + ('name' in definition ? ` "${definition.name}"` : '');
            })
    );
}

function mcguffinDefinitionOrAnchorSequence(rule: Rule, grammar: TSQGrammar, definitions: Pattern[]): StructuralDiagnostic[] {
    let diagnostics: StructuralDiagnostic[] = [];
    const unrecognized = recognizeDefinitions(grammar, definitions);
    if (!!unrecognized.length) {
        diagnostics.push(...unrecognized);
    } else {
    }
    return diagnostics;
}

function mcguffinNamedNode(node: NamedNode, grammar: TSQGrammar): StructuralDiagnostic[] {
    let diagnostics: StructuralDiagnostic[] = [];
    let unrecognized = node.children.flatMap(child => {});
    if (!!unrecognized.length) {
        diagnostics.push(...unrecognized);
    } else {
    }
    return diagnostics;
}

/* Given Tree `tree`:
iterate children and validate:
    intrinsic identity
    parent-child identity
    structure
    value
  */

// function mcguffinNamedNode() {
//     let childrenIdentityValidationResult = validateChildrenIdentity();
//     if (childrenIdentityValidationResult) {
//         let childrenStructureIsValid = validateChildrenStructure();
//     }
//     let childValuesValidationResult = validateChildrenValues();
// }

function validateChildrenIdentity(children: Pattern[], grammar: TSQGrammar): any[] {
    let diagnostics: any[] = [];
    for (let child of children.filter(isNotAnchor)) {
        if (Array.isArray(child)) {
            continue;
        }
        switch (child.type) {
            case 'AnonymousNode':
                break;
            case 'FieldDefinition':
                break;
            case 'NamedNode':
                break;
            case 'Predicate':
                break;
            case 'AnonymousNode':
                if (child.name === '_') {
                    continue;
                }
            //  ^?
            case 'MissingNode':
                break;
        }
    }
    throw new Error('Function not implemented.');
    return diagnostics;
}

function validateChildrenStructure() {
    throw new Error('Function not implemented.');
}

function validateChildrenValues() {
    throw new Error('Function not implemented.');
}
