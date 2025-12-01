import { Identifier, IntegerRange as exclusiveRange, nameOfNamedNode } from './junk_drawer';
import {
    AnonymousNode,
    Definition,
    DefinitionChild,
    List,
    NamedNode,
    NegatedField,
    Pattern,
    PseudoTerminalChild,
    StructuralDiagnostic,
    flattenChildIdentity,
    isNotAnchor,
} from './lints/StructuralLinting';
import { NodeTypes } from './node_types';
import { isNotNullish } from './predicates';
import { TSNode } from './reexports';
import RuleJSON from './RuleJSON';
import { Terminality } from './Terminality';
import { Literal } from './typeChecking';
import { Error, Indices, NonDescript, PathedRule, ResolvedRule, RulePath, RuleState, UnrecognizedNode } from './untitled';

export type GrammarJSON<R extends string = string> = {
    name: string;
    rules: Record<R, RuleJSON>;
    inherits?: string;
    extras?: RuleJSON[];
    precedences?: R[][];
    reserved?: Record<string, RuleJSON[]>;
    externals?: RuleJSON[];
    inline?: R[];
    conflicts?: R[][];
    word?: R;
    supertypes?: R[];
};

export class Grammar {
    constructor(public grammar: GrammarJSON, public types: NodeTypes.Categorized) {}

    mcguffinNamedNodeRule(node: TSNode): Error[] {
        if (node.type !== 'named_node' || !node.isNamed) {
            return [];
        }
        let identifier = Identifier.ofNode(node);
        if (!identifier) {
            return [{ type: 'NonDescript', message: 'named_node has no name', context: node } satisfies NonDescript];
        }
        let name = identifier.text;
        let rule = this.resolveRuleFor(name);
        if (!rule) {
            return [{ type: 'UnrecognizedNode', node: identifier } satisfies UnrecognizedNode];
        }
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                let children = node.children.filter(isNotNullish).filter(TSNode.isDefinitionChild);
                return children.map(child => {
                    return {
                        type: 'NonDescript',
                        message: `"${rule.type}"-type Rule "${name}" cannot have child definitions`,
                    } satisfies NonDescript;
                });
            case 'SEQ':

            case 'CHOICE':
            case 'REPEAT':
            case 'REPEAT1':
            case 'FIELD':
                return [];
            default:
                rule satisfies never;
                throw `Unhandled Rule type "${rule['type']}"`;
        }
    }

    // matchThingy(node: TSNode, rule: PathedRule): TSNode[] {
    //     let nodes = TSNode.firstPseudoTerminalDescendants(node);
    //     if (!nodes.length) {
    //         return [];
    //     }
    //     let map = new Dict<number, Set<string>>();
    //     let pairs = nodes.map(node_ => ...this.matchingNodePathableRulePairs(node_, rule));
    // }
    matchingPathableRules(node: TSNode, rule: PathedRule): PathedRule[] {
        let matching: PathedRule[] = [];
        for (let subrule of PathedRule.walkTerminals(rule, this)) {
            this.terminalNodeMatchesTerminalRule(node, subrule) && matching.push(subrule);
        }
        return matching;
    }

    terminalNodeMatchesTerminalRule(node: TSNode, rule: PathedRule): boolean {
        switch (rule.type) {
            case 'BLANK':
                return false;
            case 'STRING':
                return node.type === 'anonymous_node' && (node.text === '_' || node.text.slice(1, -2) === rule.value);
            case 'PATTERN':
                return false;
            case 'SYMBOL':
                return node.type === 'named_node' && nameOfNamedNode(node) === rule.name;
            case 'SEQ':
            case 'CHOICE':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return false;
        }
    }

    matchingNodePathableRulePairs(node: TSNode, rule: PathedRule): [TSNode, PathedRule][] {
        return this.matchingPathableRules(node, rule).map(subrule => [node, subrule]);
    }

    // matchSequence(node: TSNode, rule: Rule.Sequence): boolean {
    //     // if () {}
    // }
    mcguffinNamedNodeChildren(node: TSNode, name: string, rule: RuleJSON) {
        let round = TSNode.firstPseudoTerminalDescendants(node);
        while (!!round.length) {}
    }

    mcguffinTerminalRule(node: TSNode, rule: RuleJSON) {}

    hmm(pattern: Pattern, rule: RuleJSON, seen: Set<string> = new Set()) {
        if (Pattern.hasMembers(pattern) && RuleJSON.hasMembers(rule)) {
        } else if (Pattern.hasMembers(pattern)) {
            return;
        } else if (RuleJSON.hasMembers(rule)) {
        } else {
            switch (pattern.type) {
                case 'AnonymousNode':
                    return (
                        RuleJSON.isAnonymous(rule) &&
                        (pattern.name === '_' || (rule.type === 'STRING' && pattern.name === rule.value))
                    );
                case 'FieldDefinition':
                case 'MissingNode':
                case 'NamedNode':
                case 'Predicate':
                case 'NegatedField':
            }
        }
        return undefined;
    }

    // nextImmediateRules(rule: Rule, seen: Set<string> = new Set()): [Rule, number[]][] {
    //     switch () {}
    // }
    canIGetUhhh(pattern: Pattern, rule: RuleJSON) {}

    *generateNextPossibleRules(rules: RuleJSON[], seen: Set<string> = new Set()) {
        return rules.flatMap(rule => {});
        // switch (rules.type) {
        //     case 'BLANK':
        //     case 'STRING':
        //     case 'PATTERN':
        //         yield [rules];
        //         return [];
        //     case 'SYMBOL':
        //         if (seen.has(rules.name)) {
        //             return [];
        //         }
        //         yield [rules];
        //         let newRule = this.ruleFor(rules);
        //         yield* this.generateNextRule(newRule, seen);
        //         return;
        //     case 'SEQ':
        //         for (let member of rules.members) {
        //             yield* this.generateNextRule(member);
        //         }
        //     case 'CHOICE':
        //     case 'ALIAS':
        //     case 'REPEAT':
        //     case 'REPEAT1':
        //     case 'RESERVED':
        //     case 'TOKEN':
        //     case 'IMMEDIATE_TOKEN':
        //     case 'FIELD':
        //     case 'PREC':
        //     case 'PREC_LEFT':
        //     case 'PREC_RIGHT':
        //     case 'PREC_DYNAMIC':
        // }
    }

    hasLiteral(literal: string): boolean {
        return this.types.literals.map(node => node.type).includes(literal as Literal);
    }

    hasAnonymousNode(node: AnonymousNode): boolean {
        return node.isWildcard || this.hasLiteral(node.name);
    }

    hasNamedNode(node: NamedNode): boolean {
        return node.name === '_' || this.hasRule(node.name);
    }

    get ruleNames(): string[] {
        return Object.getOwnPropertyNames(this.grammar.rules);
    }

    iterateRulePaths(): RulePath[] {
        let paths: RulePath[] = [];
        for (let [name, rule] of Object.entries(this.grammar.rules)) {
            let path: RulePath = [name];
            let indices = RuleJSON.index(rule);
            paths.push(...indices.map(i => [name, ...i] satisfies RulePath));
        }

        return paths;
    }

    hasHidden(rule: RuleJSON.Symbol): boolean;
    hasHidden(name: string): boolean;
    hasHidden(arg: RuleJSON.Symbol | string): boolean {
        let name = RuleJSON.nameFrom(arg);
        return name.startsWith('_') || this.hasSupertype(name);
    }

    getHidden(arg: RuleJSON.Symbol | string) {
        let name = RuleJSON.nameFrom(arg);
        return name.startsWith('_') ? this.ruleFor(name) : this.getSupertype(name);
    }

    hasSupertype(name: string): boolean;
    hasSupertype(symbol: RuleJSON.Symbol): boolean;
    // hasSupertype(arg: Rule.Symbol | string): boolean;
    hasSupertype(arg: RuleJSON.Symbol | string): boolean {
        let name = typeof arg === 'string' ? arg : arg.name;
        return !!this.grammar.supertypes && this.grammar.supertypes.includes(name);
    }

    getSupertype(arg: RuleJSON.Symbol | string): RuleJSON.Choice | undefined {
        return this._getSupertype(arg);
    }

    _getSupertype(arg: RuleJSON.Symbol | string, emitWarnings: boolean = true): RuleJSON.Choice | undefined {
        const name = RuleJSON.nameFrom(arg);
        if (!this.hasSupertype(name)) {
            emitWarnings && console.warn(`Attempted to get non-supertype supertype "${name}"`);
            return;
        }
        let supertype = this.ruleFor(name);
        if (!supertype) {
            emitWarnings && console.warn(`Unable to find supertype "${name}"`);
            return;
        }
        if (supertype.type !== 'CHOICE') {
            emitWarnings && console.warn(`Supertype "${name}" was not type "CHOICE": "${supertype.type}"`);
            return;
        }
        return supertype;
    }

    indexIntoRule(rule: RuleJSON, index: number): RuleJSON | undefined {
        switch (rule.type) {
            case 'BLANK':
                console.warn(`${rule.type} rule cannot be indexed`);
                return;
            case 'STRING':
            case 'PATTERN':
                console.warn(`${rule.type} rule "${rule.value}" cannot be indexed`);
                return;
            case 'SYMBOL':
                if (index !== 0) {
                    console.warn(`Invalid index for ${rule.type} ${rule.name}: '${index}'`);
                    return;
                }
                return this.ruleFor(rule);
            case 'SEQ':
            case 'CHOICE':
                return rule.members.at(index);
            case 'ALIAS':
                if (index !== 0) {
                    console.warn(`Invalid index for ${rule.type} '${rule.value}': '${index}'`);
                    return;
                }
                return rule.content;

            case 'FIELD':
            case 'REPEAT':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                if (index !== 0) {
                    console.warn(`Invalid index for ${RuleJSON.format(rule)}: '${index}'`);
                    return;
                }
                return rule.content;
            case 'REPEAT1':
                if (index !== 0 && index !== 1) {
                    console.warn(`Invalid index for ${rule.type}: '${index}'`);
                    return;
                }
                return rule.content;
                break;
            default:
                console.error(`Supposedly impossible state is definitiely possible ...`);
                return;
        }
    }

    rulesInPath(name: string, indices: number[]): RuleJSON[] {
        const first = this.ruleFor(name);
        if (!first) {
            return [];
        }
        let rules: RuleJSON[] = [];
        let rule: RuleJSON | undefined = first;
        for (let index of indices) {
            if (!rule) {
                break;
            }
            rules.push(rule);
            rule = this.indexIntoRule(rule, index);
        }

        return rules;
    }

    ruleFromPath(name: string, path_: number[]): RuleJSON | undefined {
        let rule: RuleJSON | undefined = this.ruleFor(name);
        let path = [...path_];
        // let index: number | undefined = path.shift();
        for (let index of path_) {
            if (!rule) {
                break;
            }
            rule = this.indexIntoRule(rule, index);
        }
        return rule;
    }

    ruleCanContainPseudoTerminalChild(rule: RuleJSON, child: PseudoTerminalChild): boolean {
        switch (rule.type) {
            case 'BLANK':
                return child.type === 'NegatedField';
            case 'STRING':
                return child.type === 'AnonymousNode' && (child.isWildcard || rule.value === child.name);
            case 'PATTERN':
                console.debug(
                    `PATTERN '${rule.value} w PseudoTerminalChild of type '${child.type}'` + !!rule.flags
                        ? `' w flags '${rule.flags}'`
                        : ''
                );
                return false; // TODO ?
            case 'SYMBOL':
                if (!RuleJSON.isHidden(this.grammar, rule)) {
                    return child.type === 'NamedNode' && rule.name === child.name;
                } else {
                    let resolved = this.resolveRuleFor(rule.name);
                    return !!resolved && this.ruleCanContainPseudoTerminalChild(resolved, child);
                }
            case 'SEQ':
            case 'CHOICE':
                return rule.members.some(member => this.ruleCanContainPseudoTerminalChild(member, child));
            case 'ALIAS':

            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return this.ruleCanContainPseudoTerminalChild(rule.content, child);
            case 'FIELD':
                return child.type === 'FieldDefinition' && rule.name === child.name;
        }
    }

    hasDefinition(definition: Definition | NegatedField): boolean {
        switch (definition.type) {
            case 'AnonymousNode':
                return this.hasAnonymousNode(definition);
            case 'FieldDefinition':
                break; // TODO
            case 'Grouping':
                return definition.members.filter(isNotAnchor).every(member => this.hasDefinition(member));
            case 'List':
                return definition.members.every(member => this.hasDefinition(member));
            case 'MissingNode':
                break;
            case 'NamedNode':
                return this.hasRule(definition.name);
            case 'Predicate':
                break;
        }
        return false;
    }

    hasRule(name: string): boolean {
        return name in this.grammar.rules;
    }

    ruleFor(arg: TSNode | string | RuleJSON.Symbol | undefined): RuleJSON | undefined {
        if (typeof arg === 'string') {
            return !(arg in this.grammar.rules) ? undefined : this.grammar.rules[arg];
        }
        if (typeof arg !== 'object') {
            return arg;
        }
        if ('name' in arg) {
            return this.ruleFor(arg.name);
        }
        if (arg.type === 'named_node') {
            return this.ruleFor(nameOfNamedNode(arg));
        }
        // if (!arg) {
        //     typeof arg;
        //     //       ^?
        //     return arg;
        // }
        return undefined;
    }

    getRuleByName(name: string): RuleJSON | undefined {
        return !(name in this.grammar.rules) ? undefined : this.grammar.rules[name];
    }

    getPathedRuleByName(name: string): PathedRule | undefined {
        let rule = this.getRuleByName(name);
        return !rule ? undefined : { ...rule, path: [name] };
    }

    matchingSubRules(node: TSNode, rule: PathedRule): PathedRule[] {
        return []; // TODO;
    }

    resolveRuleFor(arg: TSNode | string | undefined): ResolvedRule | undefined {
        let rule = this.ruleFor(arg);
        const MAX_DEPTH = 1000;
        for (let _iteration of exclusiveRange(MAX_DEPTH)) {
            switch (rule?.type) {
                case undefined:
                    return undefined;
                case 'SYMBOL':
                    rule = this.ruleFor(rule);
                    continue;
                case 'ALIAS':
                case 'PREC':
                case 'PREC_LEFT':
                case 'PREC_RIGHT':
                case 'PREC_DYNAMIC':
                case 'RESERVED':
                case 'TOKEN':
                case 'IMMEDIATE_TOKEN':
                    rule = rule.content;
                    continue;
                case 'FIELD':
                case 'REPEAT':
                case 'REPEAT1':
                case 'BLANK':
                case 'STRING':
                case 'PATTERN':
                case 'SEQ':
                case 'CHOICE':
                    return rule;
                default:
                    rule satisfies never;
                // throw `unhandled case "${rule?.type}"`;
            }
        }
        throw `Max resolution depth of '${MAX_DEPTH}' reached`;
    }

    ruleIsHidden(symbol: RuleJSON.Symbol): boolean | undefined;
    ruleIsHidden(name: string): boolean | undefined;
    ruleIsHidden(arg: string | RuleJSON.Symbol): boolean | undefined;
    ruleIsHidden(arg: string | RuleJSON.Symbol): boolean | undefined {
        arg = typeof arg === 'string' ? arg : arg.name;
        if (!this.hasRule(arg)) {
            return;
        }
        return arg.startsWith('_') || arg in (this.grammar.supertypes ?? []);
    }

    // pseudoTerminalChildCanBelongToRule(child: PseudoTerminalChild): boolean {
    // }
    definitionCanBeChildOfRule(definition: Definition | NegatedField, rule: RuleJSON): boolean {
        if (definition.type === 'Grouping' || definition.type === 'List') {
            return definition.members.every(
                (member: Definition | '.') => member === '.' || this.definitionCanBeChildOfRule(member, rule)
            );
        }
        switch (rule.type) {
            case 'BLANK':
                return definition.type === 'NegatedField';
            case 'STRING':
                return definition.type === 'AnonymousNode' && (definition.isWildcard || definition.name === rule.value);
            case 'PATTERN':
                return true; // TODO
            case 'SYMBOL':
                if (definition.type === 'NamedNode' && definition.name === rule.name) {
                    return true;
                }
                let resolved: ResolvedRule | undefined = this.resolveRuleFor(rule.name);
                return !!resolved && this.definitionCanBeChildOfRule(definition, resolved);
            case 'SEQ':
            case 'CHOICE':
                return rule.members.some(member => this.definitionCanBeChildOfRule(definition, member));
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
            case 'RESERVED':
                return this.definitionCanBeChildOfRule(definition, rule.content);
            case 'FIELD':
                return definition.type === 'FieldDefinition' && definition.name === rule.name;
        }
    }

    identifyPseudoTerminalOrphan(orphan: PseudoTerminalChild): StructuralDiagnostic[] {
        switch (orphan.type) {
            case 'AnonymousNode':
                return this.hasAnonymousNode(orphan) ? [] : [`Unrecognized AnonymousNode "${orphan.name}"`];
            case 'FieldDefinition':
                return []; // TODO
            case 'MissingNode':
                return []; // TODO
            case 'NamedNode':
                return this.hasNamedNode(orphan) ? [] : [`Unrecognized NamedNode "${orphan.name}"`];
            case 'NegatedField':
                return []; // TODO
        }
    }

    identifyOrphan(orphan: Definition | NegatedField | '.'): StructuralDiagnostic[] {
        if (orphan === '.') {
            return [];
        }
        return flattenChildIdentity(orphan).flatMap(child => this.identifyPseudoTerminalOrphan(child));
    }

    // identifyPseudoTerminalChild(parent: NamedNode, child: PseudoTerminalChild): StructuralDiagnostic[] {
    //     let asOrphan = this.identifyPseudoTerminalOrphan(child);
    //     if (!!asOrphan.length) {
    //         return asOrphan;
    //     }
    // }
    identifyChild(parent: NamedNode, child: DefinitionChild, rule: RuleJSON): StructuralDiagnostic[] {
        let terminals = flattenChildIdentity(child);
        return terminals.flatMap(terminal => {
            let asOrphan = this.identifyPseudoTerminalOrphan(terminal);
            if (!!asOrphan.length) {
                return asOrphan;
            }
            if (this.ruleCanContainPseudoTerminalChild(rule, terminal)) {
                return [];
            }
            return `NamedNode '${parent.name}' has no child of type `;
        });
    }

    OrphanList(list: List) {
        list.members.flatMap(member => !this.hasDefinition(member));
    }

    nextMatchingIndex(rule: RuleJSON, child: DefinitionChild, index: number[]) {
        if (!index.length) {
            return;
        }
        let current = this.subStateFromIndices(rule, index as Indices);
        if (!current) return undefined;
    }

    theThing(rule: RuleJSON, children: DefinitionChild[]) {
        let child = children.shift();
        while (!!child) {}
    }

    subStateFromIndex(rule: RuleJSON, index: number): RuleJSON | undefined {
        switch (rule.type) {
            case 'SYMBOL': {
                let subRule = this.ruleFor(rule);
                return !subRule ? undefined : this.subStateFromIndex(subRule, index);
            }
            case 'SEQ':
            case 'CHOICE': {
                let result = rule.members.at(index);
                result || console.error(`Out-of-bounds index ${rule.type}[${index}] for ${rule.members.length}-length members`);
                return result;
            }
            case 'REPEAT':
                if (index === 0) {
                    return rule.content;
                }
                console.error(`Invalid REPEAT index '${index}'`);
                return undefined;
            case 'REPEAT1':
                switch (index) {
                    case 0: // First item
                    case 1: //(n + 1)th item
                        return rule.content;
                    default:
                        console.error(`Invalid REPEAT1 index '${index}'`);
                        return undefined;
                }

            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                if (index === 0) {
                    return rule;
                }
                console.error(`Invalid index: ${rule.type}[${index}]`);
                return undefined;
            case 'ALIAS':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return this.subStateFromIndex(rule.content, index);
        }
    }

    statesFromIndices(rule: RuleJSON, indices: Indices): RuleJSON[] {
        let states: RuleJSON[] = [rule];
        let current: RuleJSON | undefined = rule;
        for (let index of indices) {
            current = this.subStateFromIndex(current, index);
            if (!current) {
                break;
            }
            states.push(current);
        }
        return states;
    }

    subStateFromIndices(rule: RuleJSON, indices: Indices): RuleJSON | undefined {
        let current: RuleJSON | undefined = rule;
        for (let index of indices) {
            if (!!current) {
                current = this.subStateFromIndex(current, index);
            }
        }
        return current;
    }

    iterateRuleIndices(rule: RuleJSON, seen: string | Set<string> = new Set(), stack: Indices | [] = []): Indices[] {
        if (typeof seen === 'string') {
            seen = new Set(seen);
        }
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                return [[...(stack as Indices)]];
            case 'SEQ':
            case 'CHOICE':
                return rule.members.flatMap((member, index, _) => this.iterateRuleIndices(member, seen, [...stack, index]));
            case 'SYMBOL':
                if (seen.has(rule.name)) {
                    return [];
                }
                seen.add(rule.name);
                let subrule = this.ruleFor(rule);
                if (!subrule) {
                    return [];
                }
                // return [[...stack, 0], ...this.iterateRuleIndices(subrule, seen, [...stack, 0])];
                return [[...stack, 0], ...this.iterateRuleIndices(subrule, seen, [...stack, 0])];
            case 'ALIAS':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return this.iterateRuleIndices(rule.content, seen, [...stack]);
            case 'REPEAT':
                return this.iterateRuleIndices(rule.content, seen).map(inner => [...stack, ...inner]);
            case 'REPEAT1':
                return this.iterateRuleIndices(rule.content, seen).flatMap(
                    inner =>
                        [
                            [...stack, 0, ...inner],
                            [...stack, 1, ...inner],
                        ] satisfies [Indices, Indices]
                );
            case 'FIELD':
                return [[...stack, 0], ...this.iterateRuleIndices(rule.content, seen, [...stack, 0])];
        }
    }

    matchingSubstates(rule: RuleJSON, child?: DefinitionChild): RuleState[] {
        return []; // TODO
    }

    nextPossibleStates(rule: RuleJSON, child: DefinitionChild, currentStates: RuleState[]): RuleState[] {
        return []; // TODO
    }

    mcguffinDefinitionIdentityAndLineage(definition: Pattern, parent?: RuleJSON): any[] {
        switch (definition.type) {
            case 'AnonymousNode':
                if (!this.hasAnonymousNode(definition)) {
                    return [`Unrecognized AnonymousNode "${definition.name}"`];
                }
                if (!!parent && !this.definitionCanBeChildOfRule(definition, parent)) {
                    return [`Invalid child-parent pair: {${Pattern.format(definition)} · ${RuleJSON.format(parent)}}`];
                }
                return [];
            case 'FieldDefinition':
                return this.hasField(definition.name) ? [] : [`Unrecognized FieldDefinition "${definition.name}"`];
            case 'Grouping':
                let hmm = definition.members.filter(isNotAnchor); //.flatMap(member => this.mcguffinDefinitionIdentity(member));
            case 'List':
            case 'MissingNode':
            case 'NamedNode':
            case 'Predicate':
            case 'NegatedField':
        }
        return [];
    }
    hasField(name: string): boolean {
        throw new Error('Method not implemented.');
    }

    mcguffinNamedNode(rule: RuleJSON, children: Pattern[]) {
        let unrecognized: any[] = [];
        let nonChildren: any[] = [];

        let errors: any[] = [];

        let current: RuleState[] = this.matchingSubstates(rule, children.shift());
        let checkStructure: boolean = true;
        if (!current.length) return;
        let next: RuleState[] = [];
        for (let child of children) {
            if (checkStructure) {
                next = this.nextPossibleStates(rule, child, current);
                if (!!next.length) {
                    current = next;
                    continue;
                }
                checkStructure = false;
            }
            if (this.definitionCanBeChildOfRule(child, rule)) {
                errors;
            } else {
            }
        }
    }

    ruleFromRulePath(path: RulePath): RuleJSON | undefined {
        let [name, ...indices] = path;
        indices.slice;
        let rule = this.ruleFor(name);
        if (!rule || !Indices.is(indices)) {
            return;
        }
        return this.subStateFromIndices(rule, indices);
    }

    pathedRuleFromRulePath(path: RulePath): PathedRule | undefined {
        let rule = this.ruleFromRulePath(path);
        if (!rule) {
            return;
        }
        return {
            path,
            ...rule,
        };
    }

    parentFromPathedRule(rule: PathedRule): PathedRule | undefined {
        let path: RulePath | undefined = RulePath.parentPath(rule.path);
        return !path ? undefined : this.pathedRuleFromRulePath(path);
    }

    nextSibling(rule: PathedRule): PathedRule | undefined {
        if (rule.path.length === 1) {
            return;
        }
        let [name, ...indices] = RulePath.copy(rule.path);
        indices.push(indices.pop()! + 1);
        return this.pathedRuleFromRulePath([name, ...indices]);
    }

    nextPseudoTerminalSiblings(rule: PathedRule): PathedRule[] {
        let parent = this.parentFromPathedRule(rule);
        if (parent?.type === 'CHOICE') {
            return this.nextPseudoTerminalSiblings(parent);
        }

        let next: PathedRule | undefined = this.nextSibling(rule);
        while (!!next) {
            switch (Terminality.ofRule(next)) {
                case Terminality.Terminal:
                case Terminality.PseudoTerminal:
                    return [next];
                case Terminality.NonTerminal:
            }
        }
        switch (rule.type) {
            case 'CHOICE':
            // next = this.pseudoTerminalDescendants(rule);
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SYMBOL':
            case 'SEQ':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
        }
        // if (!next)
        // if (!next.length && !parent) {
        //     return [];
        // }
        return []; // TODO
    }
    firstPseudoTerminalDescendants(rule: PathedRule): PathedRule[] {
        return []; // TODO
    }

    pseudoTerminalDescendants(rule: PathedRule): PathedRule[] {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                return [];
            case 'SYMBOL':
            case 'SEQ':

            case 'CHOICE':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
        }
        return []; // TODO
    }

    mcguffin(rule: RuleJSON, children: Pattern[]) {}
}
