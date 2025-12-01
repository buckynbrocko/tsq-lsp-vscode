import { Dict } from './Dict';
import { GrammarJSON } from './Grammar';
import { InvalidField, InvalidNamedNodeFieldValue, Issue, UnexpectedFieldValueChild } from './Issue';
import { Counter, countUniqueIDs, firstOf, MaxIterations, uniqueByID, wrap } from './itertools';
import { Definition, FieldDefinition, PseudoTerminalDefinition, TerminalDefinition } from './MetaNode';
import { isNotNullish } from './predicates';
import { TSNode } from './reexports';
import Rule from './Rule';
import { KindaNonTerminal, KindaTerminal, PseudoTerminal, Terminal, Terminality } from './Terminality';

class DiagnosticRound {
    constructor(
        public node: KindaTerminal<Definition>,
        public rules: KindaTerminal<Rule>[],
        public lineage: KindaTerminal<Definition>[] = []
    ) {}

    get root(): KindaTerminal<Definition> | undefined {
        return firstOf(this.lineage);
    }

    get hasRules(): boolean {
        return !!this.rules.length;
    }

    matchingRules() {
        if (this.node instanceof FieldDefinition) {
            return this.rules.filter(
                rule => (rule instanceof Rule.Field && rule.matchesName(this.node)) || rule.matchesMetaNode(this.node)
            );
        }
        return this.rules.filter(rule => rule.matchesMetaNode(this.node));
    }

    nextNodes() {
        let nodes = this.node.nextTerminals();
        let root = this.root;
        if (root) {
            nodes = nodes.filter(node => root.hasDescendant(node));
        }
        return nodes;
    }

    nextRules(rules?: KindaTerminal<Rule>[]): KindaTerminal<Rule>[] {
        rules = rules ?? this.matchingRules();
        return uniqueByID(rules.flatMap(rule => rule.subsequentTerminals()));
    }

    result(nextRules?: KindaTerminal<Rule>[], nextNodes?: KindaTerminal<Definition>[]) {
        nextRules = nextRules ?? this.nextRules();
    }

    static consolidate(rounds: DiagnosticRound[]): DiagnosticRound[] {
        let IDs = countUniqueIDs(rounds.map(round => round.node));
        if (rounds.length === IDs) {
            return rounds;
        }

        let map = new Map<number, DiagnosticRound>();
        for (let round of rounds) {
            let mappedRound = map.get(round.node.id);
            if (mappedRound) {
                mappedRound.rules.push(...round.rules);
            } else {
                map.set(round.node.id, round);
            }
        }
        return [...map.values()];
    }
}

export class QueryGrammar {
    supertypeNames: Set<string>;
    supertypes: Rule[];
    IDRuleMap: Dict<number, Rule> = new Dict();
    topLevelRules: Dict<string, Rule> = new Dict();
    aliases: Dict<string, Rule.Alias[]> = new Dict();
    extras: Rule[] = [];
    extrasNames: Set<string>;
    constructor(public grammar: GrammarJSON) {
        this.supertypeNames = new Set(grammar.supertypes ?? []);
        this.extrasNames = new Set((grammar.extras ?? []).filter(e => e.type === 'SYMBOL').map(e => e.name));
        let IDs = new Counter();
        for (let [name, topLevelRule_] of Object.entries(grammar.rules)) {
            let topLevelRule = Rule.fromRuleJSON(topLevelRule_, IDs, this, name);
        }
        this.supertypes = [...this.supertypeNames].map(name => this.getTopLevelRule(name)).filter(isNotNullish);
    }

    get IDs(): number[] {
        return this.IDRuleMap.keysArray();
    }

    get rootRule(): Rule | undefined {
        return this.getByID(0);
    }

    diagnoseRounds(firstRounds: DiagnosticRound[]): Issue[] {
        let currentRounds = firstRounds;
        let nextRounds: DiagnosticRound[] = [];
        let max = new MaxIterations(100);
        let log: Definition[][] = [];
        while (!!currentRounds.length && max.ok) {
            let passLog = [];
            for (let round of currentRounds) {
                passLog.push(round.node);
                let nextNodes: KindaTerminal<Definition>[];
                let nextRules: KindaTerminal<Rule>[];
                let matchingRules: KindaTerminal<Rule>[];
                if (round.node instanceof Definition.NamedNode && round.node.isExtra) {
                    let root = round.root;
                    if (
                        max.count === 1 &&
                        root instanceof Definition.NamedNode &&
                        root.isRoot &&
                        this.rootRule instanceof Rule.Sequence
                    ) {
                        // extra can't be the very first definition if the root rule is a sequence. Took forever to (only possibly) figure this out
                        return Issue.fromUnexpectedNode(round.node).asArray;
                    }

                    nextNodes = round.nextNodes();
                    if (!nextNodes.length) {
                        continue;
                    }
                    nextRules = round.rules;
                } else {
                    matchingRules = round.matchingRules();
                    if (!matchingRules.length) {
                        if (round.root && Terminality.isPseudoTerminal(round.root)) {
                            return Issue.fromUnexpectedNode(round.node, round.root).asArray;
                        } else {
                            return Issue.fromUnexpectedNode(round.node).asArray;
                        }
                    }
                    nextNodes = round.nextNodes();
                    if (!nextNodes.length) {
                        continue;
                    }

                    nextRules = round.nextRules(matchingRules);
                }

                let roundResult = nextNodes.map(node => new DiagnosticRound(node, nextRules, round.lineage));
                nextRounds.push(...roundResult);
            }
            currentRounds = DiagnosticRound.consolidate(nextRounds);
            nextRounds = [];
            log.push(passLog);
            passLog = [];
        }
        return [];
    }

    diagnoseMetaNode(node: Definition) {
        let identityIssues = this.diagnoseIdentity(node);
        if (!!identityIssues.length) {
            return identityIssues;
        }
        if (Terminality.isTerminal(node)) {
            // return node.terminalChildren().map(child => Issue.fromInvalidNode(child, node));
            return [];
            // TODO?
        }
        let terminalChildrenPlusExtras = node.terminalChildren(false);
        let terminalChildren = node.terminalChildren();
        if (terminalChildren.length === terminalChildrenPlusExtras.length && !terminalChildren.length) {
            return [];
        }
        let childIdentityIssues = this.diagnoseChildIdentityIssues(node);
        // let childIdentityIssues = terminalChildren.flatMap(terminal => this.diagnoseKindaTerminalIdentity(terminal));
        if (!!childIdentityIssues.length) {
            return childIdentityIssues;
        }
        if (Terminality.isNonTerminal(node)) {
            return childIdentityIssues;
        }

        let rules: KindaTerminal<Rule>[];
        switch (node.nodeType) {
            case 'named_node':
                let rulesByName = this.getByName(node.name);
                rules = rulesByName.flatMap(rule => rule.thisOrTerminalDescendants());
                break;
            case 'field_definition':
                rules = this.rulesOfType('FIELD');
                break;
            default:
                throw node satisfies never;
        }

        let children: KindaTerminal<Definition>[] = node.firstTerminalChildren(false);
        let lineage: KindaTerminal<Definition>[] = [node];
        let rounds: DiagnosticRound[] = children.map(child => new DiagnosticRound(child, rules, lineage));

        return !rounds.length ? [] : this.diagnoseRounds(rounds);
    }

    rulesForKindaNonTerminal(node: KindaNonTerminal<Definition>): KindaTerminal<Rule>[] {
        switch (node.nodeType) {
            case 'named_node':
                return this.getByName(node.name).flatMap(rule => rule.thisOrTerminalDescendants());
            case 'grouping':
            case 'list':
                return this.pseduoTerminalRules();
            case 'field_definition':
                return this.rulesOfType('FIELD');
        }
    }

    diagnoseIdentity(node: Definition): Issue[] {
        switch (node.terminality) {
            case Terminality.Terminal:
            case Terminality.PseudoTerminal:
                return this.diagnoseKindaTerminalIdentity(node);
            case Terminality.NonTerminal:
                return [];
        }
    }

    diagnoseChildIdentityIssues(node: KindaNonTerminal<Definition>): Issue[] {
        let children = node.terminalChildren();
        let childrenPlusExtras = node.terminalChildren(false);
        if (!children.length && !childrenPlusExtras.length) {
            return [];
        }
        if (node.terminality === Terminality.NonTerminal) {
            return children.flatMap(child => this.diagnoseKindaTerminalIdentity(child));
        }
        let rules = this.rulesForKindaNonTerminal(node);
        if (!rules.length) {
            if (node instanceof Definition.FieldDefinition) {
                return new InvalidField(node).asArray;
            }
            return [];
            // return Issue.fromInvalidNode(node).asArray;
        } else if (childrenPlusExtras.length && rules.every(Terminality.isTerminal)) {
            return childrenPlusExtras.map(child => Issue.fromInvalidNode(child, node));
        }
        let identityIssues = children.flatMap(child => {
            if (child instanceof FieldDefinition && rules.filter(r => r.type === 'FIELD').some(r => r.matchesName(child))) {
                return [];
            }
            if (rules.some(rule => rule.matchesMetaNode(child))) {
                return [];
            }
            if (this.canHaveTerminal(child)) {
                return Issue.fromInvalidNode(child, node);
            }
            return Issue.fromInvalidNode(child);
        });
        return identityIssues;
    }

    diagnoseKindaTerminalIdentity(node: KindaTerminal<Definition>): Issue[] {
        switch (node.terminality) {
            case Terminality.Terminal:
                return this.diagnoseTerminalIdentity(node);
            case Terminality.PseudoTerminal:
                return this.diagnosePseudoTerminalIdentity(node);
        }
    }

    diagnosePseudoTerminalIdentity(node: PseudoTerminal<Definition>): Issue[] {
        switch (node.nodeType) {
            case 'named_node':
                return node.isExtra || node.isWildcard || this.hasNonUnderscoreName(node.name)
                    ? []
                    : Issue.fromInvalidNode(node).asArray;
            case 'field_definition':
                return this.hasFieldOfName(node.name) ? [] : Issue.fromInvalidNode(node).asArray;
        }
    }

    diagnoseTerminalIdentity(node: Terminal<Definition>): Issue[] {
        switch (node.nodeType) {
            case 'missing_node':
                break;
            case 'anonymous_node':
                if (node.isWildcard) {
                    break;
                }
                if (this.rulesOfType('STRING').some(rule => rule.matchesMetaNode(node))) {
                    break;
                }
                return Issue.fromInvalidNode(node).asArray;
            default:
                node satisfies never;
        }
        return [];
    }

    diagnoseTopLevelTSNode(node: TSNode): Issue[] {
        let metaNode = Definition.tryFrom(node, this);
        let result = metaNode ? this.diagnoseMetaNode(metaNode) : [];
        return result;
    }

    // diagnoseTopLevelNode(node: MetaNode): Issue[] {
    //     switch (node.nodeType) {
    //         case 'named_node':
    //             return this.diagnoseNamedNode(node);
    //         case 'anonymous_node':
    //             return this.diagnoseAnonymousNode(node);
    //         case 'missing_node':
    //             return [];
    //         case 'grouping':
    //             return []; // TODO
    //         case 'list':
    //             return node.children().flatMap(child => this.diagnoseTopLevelNode(child));
    //         case 'field_definition':
    //             return this.diagnoseTopLevelFieldDefinition(node);
    //     }
    //     return [];
    // }

    pseduoTerminalRules(): KindaTerminal<Rule>[] {
        return this.rules.filter(Terminality.isKindaTerminal);
    }

    diagnoseTopLevelFieldDefinition(field: Definition.FieldDefinition): Issue[] {
        let fields = this.rulesOfType('FIELD').filter(rule => rule.name === field.name);
        if (!fields.length) {
            return Issue.fromInvalidNode(field).asArray;
            // return [`Unrecognized field '${field.name}'`];
        }
        let initialChildren = field.firstTerminalChildren();
        let initialRules = fields.flatMap(rule => rule.content.thisOrFirstTerminals());
        let sets = initialChildren.map(child => [child, ...initialRules] satisfies [KindaTerminal<Definition>, ...Rule[]]);
        let max = new MaxIterations(100);
        while (!!sets.length && max.ok) {
            let nextSets: typeof sets = [];
            for (let [node, ...rules] of sets) {
                let matchingRules = rules.filter(rule => rule.matchesMetaNode(node));
                if (!matchingRules.length) {
                    return [new UnexpectedFieldValueChild(field, node)];
                    // return [`Unexpected field value child: \`${field.format()}: ${node.format()}\``];
                }
                let nextNodes = node.nextTerminals();
                if (!nextNodes.length) {
                    continue;
                }

                let nextRules = matchingRules.flatMap(rule => rule.subsequentTerminals());
                if (!nextRules.length) {
                    return nextNodes.map(n => new UnexpectedFieldValueChild(field, n));
                }
                nextSets.push(...nextNodes.map(nn => [nn, ...matchingRules] satisfies [KindaTerminal<Definition>, ...Rule[]]));
            }
            sets = nextSets;
            nextSets = [];
            if (!max.ok) {
                console.error(`Max Iterations reached for field \`${field.format()}\``);
            }
        }
        return [];
    }

    identityIssuesOfNamedNode(node: Definition.NamedNode, rules: Rule[]): Issue[] {
        return node
            .terminalChildren()
            .flatMap(child => {
                if (child instanceof FieldDefinition) {
                    let fieldRules = rules.filter(rule => rule instanceof Rule.Field);
                    if (!this.hasFieldOfName(child.name)) {
                        return Issue.fromInvalidNode(child);
                    } else if (!fieldRules.some(rule => rule.name === child.name)) {
                        return Issue.fromInvalidNode(child, node);
                        // return `named node \`${node.format()}\` has no field '${child.name}'`;
                    } else if (!fieldRules.some(rule => rule.matchesContent(child.value))) {
                        return new InvalidNamedNodeFieldValue(child, node);
                        // return `Invalid value for field '${child.name}' of node \`${node.format()}\``;
                    }
                    return;
                } else {
                    if (rules.some(rule => rule.matchesMetaNode(child))) {
                        return;
                    } else if (this.canHaveTerminal(child)) {
                        return Issue.fromInvalidNode(child, node);
                        // return `Invalid child for named_node ${node.format()}: ${child.format()}`;
                    }
                    return Issue.fromInvalidNode(child);
                    // return `Unrecognized definition: ${child.format()}`;
                }
            })
            .filter(isNotNullish);
    }

    // diagnoseNamedNode(node_: MetaNode.NamedNode): Issue[] {
    //     let rules_: Rule[] = this.rulesForMetaNamedNode(node_);
    //     if (!rules_.length) {
    //         return Issue.fromInvalidNode(node_).asArray;
    //         // return [`Unrecognized named node \`${node.format()}\``];
    //     }

    //     let nodes = node_.firstTerminalChildren(false);
    //     if (!nodes.length) {
    //         return []; // named_node has no children to validate
    //     }

    //     let identityIssues = this.identityIssuesOfNamedNode(node_, rules_);
    //     if (identityIssues.length) {
    //         return identityIssues;
    //     }

    //     // NOTE tree-sitter itself seems not to alloq extras as the first child of a named_node, so this is to match it's behavior
    //     // Maybe it assumes that if there's an extra it would instead always belong to the previous/enclosing definition?

    //     let sets = nodes.map(
    //         node => [node, ...rules_.filter(r => r.matchesMetaNode(node))] satisfies [KindaNonTerminalMetaNode, ...Rule[]]
    //     );
    //     let nextSets: [KindaNonTerminalMetaNode, ...Rule[]][] = [];
    //     let max = new MaxIterations(100);
    //     while (!!sets.length && max.ok) {
    //         for (let [node, ...rules] of sets) {
    //             let matchingRules;
    //             if (node instanceof FieldDefinition) {
    //                 matchingRules = rules.filter(rule => rule instanceof Rule.Field && rule.matchesContent(node.value));
    //                 if (!matchingRules.length) {
    //                     return new InvalidNamedNodeFieldValue(node, node_).asArray;
    //                     // return [`No matching rules for ${node.format()}`]; // no rules matched
    //                 }
    //             } else {
    //                 matchingRules = rules.filter(r => r.matchesMetaNode(node));
    //                 if (!matchingRules.length) {
    //                     return Issue.fromUnexpectedChildNode(node, node_).asArray;
    //                     // return [`No matching rules for ${node.format()}`]; // no rules matched
    //                 }
    //             }
    //             let nextNodes = node.nextTerminals();
    //             if (!nextNodes.length) {
    //                 continue;
    //             }
    //             let nextRules = matchingRules.flatMap(rule => rule.subsequentTerminals());
    //             if (!nextRules.length) {
    //                 return nextNodes.map(n => Issue.fromUnexpectedChildNode(n, node_)); // no subsequent rules
    //             }
    //             let nexts = nextNodes.map(
    //                 n =>
    //                     [n, ...nextRules.filter(rule => rule.matchesMetaNode(n))] satisfies [
    //                         KindaNonTerminalMetaNode,
    //                         ...Rule[]
    //                     ]
    //             );
    //             nextSets.push(...nexts);
    //         }
    //         sets = [...nextSets];
    //         nextSets = [];
    //     }
    //     return [];
    // }

    // diagnoseNamedNode_(node__: TSNode): Issue[] {
    //     let node_ = NamedNode.tryFrom(node__, this);
    //     if (!node_) {
    //         return new NonDescript('no name found for node').asArray;
    //     }
    //     return this.diagnoseNamedNode(node_);
    // }
    hasName(name: string) {
        return this.topLevelRules.has(name) || this.aliases.has(name);
    }

    hasNonUnderscoreName(name: string) {
        return !name.startsWith('_') && (this.topLevelRules.has(name) || this.aliases.has(name));
    }

    hasFieldOfName(name: string): boolean {
        return this.rulesOfType('FIELD').some(field => field.name === name);
    }

    rulesOfType<T extends Rule['type']>(...types: T[]): Extract<Rule, { type: T }>[] {
        return this.IDRuleMap.valuesArray().filter(rule => types.includes(rule.type as T)) as Extract<Rule, { type: T }>[];
    }

    canHaveTerminal(node: TerminalDefinition | PseudoTerminalDefinition): boolean {
        switch (node.nodeType) {
            case 'named_node':
                return node.isWildcard || this.hasName(node.name);
            case 'anonymous_node':
                return node.isWildcard || this.rulesOfType('STRING', 'PATTERN').some(rule => rule.matchesValue(node.name));
            case 'field_definition':
                return this.rulesOfType('FIELD').some(rule => rule.matchesName(node));
            case 'missing_node':
                return true;
        }
    }

    // namedNodeIsValid(node: TSNode): boolean {
    //     let issues = this.diagnoseNamedNode_(node);
    //     return !issues.length;
    // }

    rulesAliasedtoName(name: string): Rule[] {
        return this.getAlias(name)
            .map(alias => (alias.content instanceof Rule.Symbol ? this.getTopLevelRule(alias.content.name) : alias.content))
            .filter(isNotNullish);
    }

    rulesForMetaNamedNode(node: Definition.NamedNode): Rule[] {
        return [this.getTopLevelRule(node.name), ...this.rulesAliasedtoName(node.name)]
            .filter(isNotNullish)
            .flatMap(r => r.thisOrTerminalDescendants());
    }

    hasAlias(name: string): boolean {
        return this.aliases.has(name);
    }

    rulesForAlias(name: string): Rule[] {
        return Rule.deduplicate((this.aliases.get(name) ?? []).flatMap(a => a.follow()));
    }

    getAlias(name: string): Rule.Alias[] {
        return this.aliases.get(name) ?? [];
    }

    isExtra(node: TSNode) {
        return this.extras.some(rule => rule.matchesTerminalNode(node));
    }

    addRule(rule: Rule, name?: string) {
        if (this.IDRuleMap.has(rule.id)) {
            throw `ReGrammar already has node with ID '${rule.id}'`;
        }
        this.IDRuleMap.set(rule.id, rule);

        if (rule instanceof Rule.Alias) {
            if (rule.named) {
                this.aliases.get(rule.value)?.push(rule) || this.aliases.set(rule.value, [rule]);
            } else {
            }
        }
        if (name === undefined) {
            return;
        }
        if (this.extrasNames.has(name)) {
            this.extras.push(rule);
        }
        if (this.topLevelRules.has(name)) {
            throw `ReGrammar already has node with name "${name}"`;
        }
        this.topLevelRules.set(name, rule);
    }

    hasSupertype(name: string): boolean {
        return this.supertypeNames.has(name);
    }

    getSupertype(name: string): Rule | undefined {
        return this.hasSupertype(name) ? this.getTopLevelRule(name) : undefined;
    }

    get rules(): Rule[] {
        return this.IDRuleMap.valuesArray();
    }

    getByID(id: number): Rule | undefined {
        return this.IDRuleMap.get(id);
    }

    getByName(name: string): Rule[] {
        if (name === '_') {
            return this.rules;
        }
        let topLevel: Rule[] = wrap(this.getTopLevelRule(name));
        return [...topLevel, ...this.rulesForAlias(name)];
    }

    getTopLevelRule(name: string, ...indices: number[]): Rule | undefined {
        let rule = this.topLevelRules.get(name);
        for (let index of indices) {
            if (!rule) break;
            rule = rule?.children.at(index);
        }
        return rule;
    }
}
