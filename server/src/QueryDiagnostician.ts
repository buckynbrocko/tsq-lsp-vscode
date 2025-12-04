// import from './Definition';
import { Definition, FieldDefinition, NamedNode } from './Definition';
import { DefinitionChild } from './DefinitionChild';
import { DiagnosticRound, DiagnosticStates } from './DiagnosticRound';
import { Grammar } from './Grammar';
import { InvalidField, Issue } from './Issue';
import { MaxIterations } from './itertools';
import Rule from './Rule';
import { KindaNonTerminal, KindaTerminal, Terminality } from './Terminality';

function diagnoseBookendExtraEdgeCase(node: Definition): Issue[] {
    if (node instanceof NamedNode && node.corespondsToStartRule && node.grammar.startRule instanceof Rule.Sequence) {
        let children = node.kindaTerminalChildren({ skipExtras: false });
        if (!(children.some(c => c.isExtra) && children.some(c => !c.isExtra))) {
            return [];
        }
        let firstChildren = node.firstKindaTerminalChildren({ skipExtras: false }).filter(child => child.isExtra);
        if (firstChildren.length) {
            return firstChildren.map(child => Issue.fromUnexpectedNode(child, node));
        }
        let lastChildren = children.filter(child => child.isLastExtra(node));
        if (lastChildren.length) {
            return lastChildren.map(child => Issue.fromUnexpectedNode(child, node));
        }
    }
    return [];
}

export class QueryDiagnostician {
    constructor(private grammar: Grammar) {}

    diagnoseRounds(firstRounds: DiagnosticRound[]): Issue[] {
        let currentRounds = firstRounds;
        let nextRounds: DiagnosticRound[] = [];
        let max = new MaxIterations(100);
        let log: DefinitionChild[][] = [];
        while (!!currentRounds.length && max.ok) {
            let passLog = [];
            for (let round of currentRounds) {
                passLog.push(round.definition);
                let nextNodes: KindaTerminal<DefinitionChild>[];
                let nextRules: KindaTerminal<Rule>[];
                let matchingRules: KindaTerminal<Rule>[];
                if (round.definition instanceof NamedNode && round.definition.isExtra) {
                    let root = round.root;
                    if (
                        max.count === 1 &&
                        // round.definition.previousSibling()
                        root instanceof NamedNode &&
                        root.corespondsToStartRule &&
                        this.grammar.startRule instanceof Rule.Sequence &&
                        round.definition.nextSibling()
                    ) {
                        // extra can't be the first of multiple definitions if the root rule is a sequence. Took forever to (only possibly) figure this out
                        return Issue.fromUnexpectedNode(round.definition).asArray;
                    } else if (
                        max.count > 1 &&
                        root instanceof NamedNode &&
                        root.corespondsToStartRule &&
                        this.grammar.startRule instanceof Rule.Sequence &&
                        !round.definition.nextKindaTerminals({ skipExtras: true, skipAnchors: true, ceiling: root }).length
                    ) {
                        return Issue.fromUnexpectedNode(round.definition).asArray;
                    }

                    nextNodes = round.nextDefinitions();
                    if (!nextNodes.length) {
                        continue;
                    }
                    nextRules = round.rules;
                } else {
                    matchingRules = round.matchingRules();
                    if (!matchingRules.length) {
                        if (round.root && round.root.isPseudoTerminal()) {
                            return Issue.fromUnexpectedNode(round.definition, round.root).asArray;
                        } else {
                            return Issue.fromUnexpectedNode(round.definition).asArray;
                        }
                    }
                    nextNodes = round.nextDefinitions();
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

    diagnoseDefinition(definition: Definition): Issue[] {
        let identityIssues = this.diagnoseIdentity(definition);
        if (!!identityIssues.length) {
            return identityIssues;
        }

        if (definition.isTerminal() || (definition.hasNoChildren({ skipExtras: false }) && definition.hasNoChildren())) {
            return [];
        }

        let childIdentityIssues = this.diagnoseChildIdentityIssues(definition);
        if (!!childIdentityIssues.length || definition.isNonTerminal()) {
            return childIdentityIssues;
        }

        const edgeCaseIssues = diagnoseBookendExtraEdgeCase(definition);
        if (edgeCaseIssues.length) {
            return edgeCaseIssues;
        }

        let states = DiagnosticStates.fromDefinition(definition);
        let state = states.shift();
        while (state) {
            let result = state?.step();
            if (Array.isArray(result)) {
                states.push(...result);
            } else if (result) {
                return [result];
            }

            state = states.shift();
        }
        return [];
    }


    _diagnoseDefinition(node: Definition) {
        let identityIssues = this.diagnoseIdentity(node);
        if (!!identityIssues.length) {
            return identityIssues;
        }

        if (node.isTerminal() || (node.hasNoChildren({ skipExtras: false }) && node.hasNoChildren())) {
            return [];
        }

        let childIdentityIssues = this.diagnoseChildIdentityIssues(node);
        if (!!childIdentityIssues.length || node.isNonTerminal()) {
            return childIdentityIssues;
        }

        let rules: KindaTerminal<Rule>[];
        switch (node.nodeType) {
            case 'named_node':
                let rulesByName = this.grammar.getByName(node.name);
                rules = rulesByName.flatMap(rule => rule.thisOrTerminalDescendants());
                break;
            case 'field_definition':
                rules = this.grammar.rulesOfType('FIELD');
                break;
            default:
                throw node satisfies never;
        }

        let children: KindaTerminal<DefinitionChild>[] = node.firstKindaTerminalChildren({ skipExtras: false });
        let lineage: KindaTerminal<Definition>[] = [node];
        let rounds: DiagnosticRound[] = children.map(child => new DiagnosticRound(child, rules, lineage));

        return !rounds.length ? [] : this.diagnoseRounds(rounds);
    }

    diagnoseIdentity(definition: Definition): Issue[] {
        return definition.isNonTerminal() || this.grammar.canHaveDefinition(definition)
            ? []
            : Issue.fromInvalidNode(definition).asArray;
    }

    diagnoseChildIdentityIssues(node: KindaNonTerminal<Definition>): Issue[] {
        let children = node.kindaTerminalChildren({ skipAnchors: true });
        let childrenPlusExtras = node.kindaTerminalChildren({ skipExtras: false, skipAnchors: true });
        if (!children.length && !childrenPlusExtras.length) {
            return [];
        }
        if (node.terminality === Terminality.NonTerminal) {
            return children.flatMap(child => this.diagnoseIdentity(child));
        }
        let rules = this.grammar.rulesForDefinition(node);
        if (!rules.length) {
            if (node instanceof FieldDefinition) {
                return new InvalidField(node).asArray;
            }
            return [];
            // return Issue.fromInvalidNode(node).asArray;
        } else if (childrenPlusExtras.length && rules.every(rule => rule.isTerminal())) {
            return childrenPlusExtras.map(child => Issue.fromInvalidNode(child, node));
        }
        let identityIssues = children.flatMap(child => {
            if (child instanceof FieldDefinition && rules.filter(r => r.type === 'FIELD').some(r => r.matchesName(child))) {
                return [];
            }
            if (rules.some(rule => rule.matchesDefinition(child))) {
                return [];
            }
            if (this.grammar.canHaveDefinition(child)) {
                return Issue.fromInvalidNode(child, node);
            }
            return Issue.fromInvalidNode(child);
        });
        return identityIssues;
    }
}
