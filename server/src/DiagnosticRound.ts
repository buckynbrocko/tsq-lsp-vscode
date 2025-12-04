import { Definition, FieldDefinition, NamedNode } from './Definition';
import { DefinitionChild } from './DefinitionChild';
import { Issue } from './Issue';
import { countUniqueIDs, firstOf, uniqueByID } from './itertools';
import Rule from './Rule';
import { KindaNonTerminal, KindaTerminal, PseudoTerminal } from './Terminality';

type PatternIndex = number[];
export namespace PatternIndex {}
class DiagnosticStep {
    constructor(private definition: Definition, isAnchored: boolean, isFirst: boolean, isLast: boolean) {}

    // fromKindaTerminal(child: KindaTerminal<DefinitionChild>, isAnchored: boolean, isFirst: boolean, isLast: boolean): DiagnosticStep[] {

    // }
}

function firstStepsOfDefinition(definition: Definition) {
    let firstChildren = definition.firstKindaTerminalChildren({ skipAnchors: false });
    switch (firstChildren.length) {
        case 0:
            return;
        case 1:
            let child = firstChildren[0]!;
            if (child.isAnchor()) {
            }
            break;
        default:
    }
}

type OneOrMore<T> = [T, ...T[]];

function populatedOrUndefined<T>(array: undefined): undefined;
function populatedOrUndefined<T>(array?: OneOrMore<T>): OneOrMore<T>;
function populatedOrUndefined<T>(array?: T[]): OneOrMore<T> | undefined;
function populatedOrUndefined<T>(array?: T[]): OneOrMore<T> | undefined {
    return !!array?.length ? (array as OneOrMore<T>) : undefined;
}

export namespace DiagnosticStates {
    export function fromDefinition(definition: PseudoTerminal<Definition>): DiagnosticState[] {
        let rules: Rule[];
        switch (definition.nodeType) {
            case 'named_node':
                rules = definition.grammar.getByName(definition.name);
                break;
            case 'field_definition':
                rules = definition.grammar.rulesOfType('FIELD');
        }
        const children = definition.firstKindaTerminalChildren({ skipAnchors: false, ceiling: definition });
        return children.map(child => DiagnosticState.from(child, rules, definition));
    }
}

export class DiagnosticState {
    private constructor(
        private child: KindaTerminal<DefinitionChild>,
        private rules?: OneOrMore<KindaTerminal<Rule>>,
        private ceiling?: KindaNonTerminal<Definition>,
        private round: number = 0 // private issues?: OneOrMore<Issue>,
    ) {
        if (child?.isDefinition() && rules) {
            this.rules = this.matchingRules(rules);
        }
    }

    matchingRules(rules: KindaTerminal<Rule>[]) {
        let result: KindaTerminal<Rule>[];
        if (this.child instanceof FieldDefinition) {
            result = rules.filter(
                rule => (rule instanceof Rule.Field && rule.matchesName(this.child)) || rule.matchesDefinition(this.child)
            );
        } else {
            result = rules.filter(rule => rule.matchesDefinition(this.child));
        }
        return populatedOrUndefined(result);
    }

    static from(child: DiagnosticState['child'], _rules: Rule[], ceiling?: KindaNonTerminal<Definition>): DiagnosticState {
        let rules: KindaTerminal<Rule>[];
        if (ceiling instanceof NamedNode) {
            if (child.isAnchor()) {
                rules = _rules.flatMap(rule => rule.thisOrFirstTerminals());
            } else {
                rules = _rules.flatMap(rule => rule.thisOrTerminalDescendants());
            }
        } else {
            rules = _rules.filter(rule => rule.isKindaTerminal()) satisfies KindaTerminal<Rule>[];
        }
        // let mapFunction = child.isAnchor() ? ((r: Rule) => r.thisOrFirstTerminals()) : ((r: Rule) => r.thisOrTerminalDescendants());
        // let rules: DiagnosticState['rules'] = populatedOrUndefined(ceilingRules.flatMap(mapFunction));
        return new DiagnosticState(child, populatedOrUndefined(rules), ceiling);
    }
    // static from(child: DiagnosticState['child'], ceilingRules: Rule[], ceiling?: KindaNonTerminal<Definition>): DiagnosticState {
    //     let mapFunction = child.isAnchor() ? ((r: Rule) => r.thisOrFirstTerminals()) : ((r: Rule) => r.thisOrTerminalDescendants());
    //     let rules: DiagnosticState['rules'] = populatedOrUndefined(ceilingRules.flatMap(mapFunction));
    //     return new DiagnosticState(child, rules, ceiling);
    // }

    step() {
        if (!this.rules) {
            return Issue.fromUnexpectedNode(this.child, this.ceiling?.asPseudoTerminal);
        }
        let nextChildren = this.nextChildren();
        if (!nextChildren) {
            return;
        }
        let nextRules = this.nextRules();
        return nextChildren.map(child => new DiagnosticState(child, nextRules, this.ceiling, this.round + 1));
    }

    private nextChildren(): OneOrMore<KindaTerminal<DefinitionChild>> | undefined {
        return populatedOrUndefined(this.child?.nextKindaTerminals({ skipAnchors: false, ceiling: this.ceiling }));
    }

    private nextRules(): DiagnosticState['rules'] {
        switch (this.child?.isAnchor()) {
            case undefined:
                return undefined;
            case true:
                return populatedOrUndefined(this.rules?.flatMap(rule => rule.nextTerminals()));
            case false:
                return populatedOrUndefined(this.rules?.flatMap(rule => rule.subsequentTerminals()));
        }
    }
}

export class DiagnosticRound {
    constructor(
        public definition: KindaTerminal<DefinitionChild>,
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
        if (this.definition instanceof FieldDefinition) {
            return this.rules.filter(
                rule =>
                    (rule instanceof Rule.Field && rule.matchesName(this.definition)) || rule.matchesDefinition(this.definition)
            );
        }
        return this.rules.filter(rule => rule.matchesDefinition(this.definition));
    }

    nextDefinitions() {
        let definitions = this.definition.nextKindaTerminals({ skipExtras: false, ceiling: this.root ?? undefined });
        return definitions;
    }

    nextRules(rules?: KindaTerminal<Rule>[]): KindaTerminal<Rule>[] {
        rules = rules ?? this.matchingRules();
        return uniqueByID(rules.flatMap(rule => rule.subsequentTerminals()));
    }

    result(nextRules?: KindaTerminal<Rule>[], nextNodes?: KindaTerminal<Definition>[]) {
        nextRules = nextRules ?? this.nextRules();
    }

    static consolidate(rounds: DiagnosticRound[]): DiagnosticRound[] {
        let IDs = countUniqueIDs(rounds.map(round => round.definition));
        if (rounds.length === IDs) {
            return rounds;
        }

        let map = new Map<number, DiagnosticRound>();
        for (let round of rounds) {
            let mappedRound = map.get(round.definition.id);
            if (mappedRound) {
                mappedRound.rules.push(...round.rules);
            } else {
                map.set(round.definition.id, round);
            }
        }
        return [...map.values()];
    }
}
