import { Definition } from './Definition';
import { Dict } from './Dict';
import { Counter, wrap } from './itertools';
import { isNotNullish } from './predicates';
import Rule from './Rule';
import RuleJSON from './RuleJSON';
import { KindaTerminal } from './Terminality';

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
    supertypeNames: Set<string>;
    supertypes: Rule[];
    IDRuleMap: Dict<number, Rule> = new Dict();
    topLevelRules: Dict<string, Rule> = new Dict();
    namedAliases: Dict<string, Rule.Alias[]> = new Dict();
    unnamedAliases: Dict<string, Rule.Alias[]> = new Dict();
    extras: Rule[] = [];
    extrasNames: Set<string>;
    constructor(public grammar: GrammarJSON) {
        this.supertypeNames = new Set(grammar.supertypes ?? []);
        this.extrasNames = new Set((grammar.extras ?? []).filter(e => e.type === 'SYMBOL').map(e => e.name));
        let IDs = new Counter();
        for (let [name, topLevelRule_] of Object.entries(grammar.rules)) {
            Rule.fromRuleJSON(topLevelRule_, IDs, this, name);
        }
        this.supertypes = [...this.supertypeNames].map(name => this.getTopLevelRule(name)).filter(isNotNullish);
    }

    get rules(): Rule[] {
        return this.IDRuleMap.valuesArray();
    }

    get IDs(): number[] {
        return this.IDRuleMap.keysArray();
    }

    get startRule(): Rule | undefined {
        return this.getByID(0);
    }

    get aliases(): Rule.Alias[] {
        return [...this.namedAliases.valuesArray(), ...this.unnamedAliases.valuesArray()].flat();
    }

    get literals(): Set<string> {
        let strings_ = this.rulesOfType('STRING')
            .filter(rule => !rule.isTopLevel)
            .filter(rule => rule.parent?.type.includes('TOKEN') || !rule.hasAncestorOfType('TOKEN', 'IMMEDIATE_TOKEN'))
            .map(rule => rule.value);
        const aliases = this.unnamedAliases
            .valuesArray()
            .flat()
            .map(alias => alias.value);
        return new Set([...strings_, ...aliases]);
    }

    rulesForDefinition(node: Definition): KindaTerminal<Rule>[] {
        switch (node.nodeType) {
            case 'anonymous_node':
            case 'missing_node':
                return [];
            case 'named_node':
                return this.getByName(node.name).flatMap(rule => rule.thisOrTerminalDescendants());
            case 'grouping':
            case 'list':
                return this.pseudoTerminalRules();
            case 'field_definition':
                return this.rulesOfType('FIELD');
        }
    }

    pseudoTerminalRules(): KindaTerminal<Rule>[] {
        return this.rules.filter(rule => rule.isKindaTerminal());
    }

    hasName(name: string) {
        return this.topLevelRules.has(name) || this.namedAliases.has(name);
    }

    hasNonUnderscoreName(name: string) {
        return !name.startsWith('_') && (this.topLevelRules.has(name) || this.namedAliases.has(name));
    }

    hasFieldOfName(name: string): boolean {
        return this.rulesOfType('FIELD').some(field => field.name === name);
    }

    hasAlias(name: string): boolean {
        return this.namedAliases.has(name);
    }

    hasSupertype(name: string): boolean {
        return this.supertypeNames.has(name);
    }

    rulesOfType<T extends Rule['type']>(...types: T[]): Extract<Rule, { type: T }>[] {
        return this.IDRuleMap.valuesArray().filter(rule => types.includes(rule.type as T)) as Extract<Rule, { type: T }>[];
    }

    canHaveDefinition(definition: Definition): boolean {
        switch (definition.nodeType) {
            case 'named_node':
                return definition.isExtra || definition.isWildcard || this.hasNonUnderscoreName(definition.name);
            case 'field_definition':
                return this.hasFieldOfName(definition.name);
            case 'missing_node':
                return true;
            case 'anonymous_node':
                return definition.isWildcard || this.rulesOfType('STRING').some(rule => rule.matchesDefinition(definition));
            case 'grouping':
            case 'list':
                return true;
            // case '.':
            //     return true;
        }
    }

    rulesForAlias(name: string): Rule[] {
        return Rule.deduplicate((this.namedAliases.get(name) ?? []).flatMap(a => a.follow()));
    }

    addRule(rule: Rule, name?: string) {
        if (this.IDRuleMap.has(rule.id)) {
            throw `ReGrammar already has node with ID '${rule.id}'`;
        }
        this.IDRuleMap.set(rule.id, rule);

        if (rule instanceof Rule.Alias) {
            if (rule.named) {
                this.namedAliases.get(rule.value)?.push(rule) || this.namedAliases.set(rule.value, [rule]);
            } else {
                this.unnamedAliases.get(rule.value)?.push(rule) || this.unnamedAliases.set(rule.value, [rule]);
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

    getSupertypeByName(name: string): Rule | undefined {
        return this.hasSupertype(name) ? this.getTopLevelRule(name) : undefined;
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
