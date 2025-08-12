import { QueryMatch } from 'web-tree-sitter';
import { LintResult } from '.';
import { CheckableNamed } from '../Checkable/Named';
import { CheckableSubnode } from '../Checkable/Subnode';
import { DiagnosticError } from '../diagnostics/DiagnosticError';
import { DiagnosticWarning } from '../diagnostics/DiagnosticWarning';
import { Identifier } from '../junk_drawer';
import { isNotNullish } from '../predicates';
import { TSNode } from '../reexports';
import { FieldName, Literal, TypeName } from '../typeChecking';
import { TypeEnvironment } from '../TypeEnvironment';
import { SingularMatchLint } from './SingularMatchLint';

export class NamedNode extends SingularMatchLint {
    static lintName = 'named-node' as const;
    lintMatch(match: QueryMatch): LintResult {
        let enclosing: TSNode | undefined = match.captures.find(c => c.name === NamedNode.lintName)?.node;
        if (!enclosing) {
            return;
        }
        const identifier = Identifier.ofNode(enclosing);
        if (!identifier || identifier.text === 'ERROR') {
            return [];
        }
        let typeName = TypeName.fromIdentifier(identifier);
        let checkedType = this.typeEnvironment.getNamed(typeName);
        if (!checkedType && typeName !== '_') {
            return DiagnosticError(identifier, `Unrecognized node '${typeName}'`);
        }

        let subnodes: TSNode[] = match.captures
            .filter(c => c.name === 'subnode')
            .map(c => c.node)
            .flatMap(flattenSubnode);

        return subnodes.flatMap(subnode => lintSubnode(subnode, this.typeEnvironment, checkedType));
    }
}

function flattenSubnode(subnode: TSNode): TSNode[] {
    switch (subnode.type) {
        case 'named_node':
        case 'anonymous_node':
        case 'field_definition':
        case 'negated_field':
            return [subnode];
        case 'list':
        case 'grouping':
            return subnode.namedChildren.filter(isNotNullish).flatMap(flattenSubnode);
        default:
            return [];
    }
}

function lintSubnode(subnode: TSNode, environment: TypeEnvironment, checkable?: CheckableNamed): LintResult {
    switch (subnode.type) {
        case 'named_node':
        case 'anonymous_node':
            return !!checkable ? lintChild(subnode, environment, checkable) : [];
        case 'field_definition':
            return lintFieldDefinition(subnode, environment, checkable);
        case 'negated_field':
            return lintNegatedField(subnode, environment, checkable);
        default:
            return [];
    }
}

function lintChild(subnode: TSNode, environment: TypeEnvironment, checkable: CheckableNamed): LintResult {
    const kind: SubnodeKind | undefined = SubnodeKind.fromValue(subnode);
    if (!kind) {
        return checkable.hasSubnodes //
            ? undefined
            : DiagnosticError(subnode, `Node '${checkable.type}' has no children/fields`);
    }

    const named: boolean = kind === 'named';
    if (!named) {
        return checkable.hasSubnodes //
            ? undefined
            : DiagnosticError(subnode, `Node '${checkable.type}' has no children/fields`);
    }
    const pool: Set<string> = named ? checkable.typeNames : checkable.literals;
    const canBeKind: boolean = !!pool.size;
    const identifier: TSNode | undefined = Identifier.ofNode(subnode);

    if (!identifier) {
        return canBeKind
            ? undefined
            : DiagnosticError(subnode, `Node '${checkable.type}' has no ${kind} children/field-values`);
    }

    const isWildcard: boolean = !identifier.isNamed;
    if (isWildcard && !canBeKind) {
        const text = named ? '(_)' : '_';
        return DiagnosticError(identifier, `Invalid subnode '${text}' - Node '${checkable.type}' has no ${kind} subnodes`);
    }
    // const name: string = (named ? identifier.text : identifier.firstNamedChild?.text) ?? '';
    const name: TypeName = TypeName.fromNode(subnode, identifier) ?? ('' as TypeName);

    if (environment.extraTypeNames.has(name)) {
        return;
    }

    if (!canBeKind) {
        const text: string = named //
            ? `(${name})`
            : `"${name}"`;
        return DiagnosticError(identifier, `Invalid subnode ${text} - Node '${checkable.type}' has no ${kind} subnodes`);
    }
    if (!isWildcard && !pool.has(name)) {
        const valueText: string = named //
            ? `'(${name})'`
            : `"${name}"`;
        return DiagnosticError(identifier, `Invalid subnode ${valueText} for node '${checkable.type}'`);
    }

    return;
}

function lintNegatedField(negated: TSNode, environment: TypeEnvironment, typeInfo?: CheckableNamed): LintResult {
    if (!environment.hasFields) {
        return DiagnosticError(negated, `No node types have fields`);
    }

    const name = FieldName.fromNode(negated);
    if (!name) {
        return;
    }
    if (!environment.hasField(name)) {
        return DiagnosticError(negated, `Unrecognized field '${name}'`);
    }
    if (!typeInfo) {
        return;
    }

    const field: CheckableSubnode | undefined = typeInfo.getField(name);
    if (!field) {
        return DiagnosticWarning(negated, `Redundant negated field - node '${typeInfo.type}' has no field '${name}'`);
    } else if (field.required) {
        return DiagnosticWarning(negated, `Negated field '${name}' is required on node '${typeInfo.type}'`);
    }
    return;
}

function lintFieldDefinition(definition: TSNode, environment: TypeEnvironment, typeInfo?: CheckableNamed): LintResult {
    const identifier = Identifier.ofField(definition);
    if (!identifier) {
        return;
    } else if (!environment.hasFields) {
        return DiagnosticError(identifier, 'No nodes have fields');
    }

    const name = FieldName.fromIdentifier(identifier);
    if (!environment.hasField(name)) {
        return DiagnosticError(identifier, `Unrecognized field '${name}'`);
    }
    const fieldInfo: CheckableSubnode | undefined = (typeInfo ?? environment).getField(name);

    if (!fieldInfo) {
        const message = !!typeInfo
            ? `Node of type '${typeInfo.type}' has no field '${name}'`
            : `No nodes have a field '${name}'`;
        return DiagnosticError(identifier, message);
    }

    let values: TSNode[] = definition.children.filter(isNotNullish).flatMap(flattenFieldValues);

    return values.flatMap(value => lintFieldValue(name, value, fieldInfo, typeInfo));
}

type SubnodeKind = 'named' | 'literal';
namespace SubnodeKind {
    export function fromValue(value: TSNode): SubnodeKind | undefined {
        if (value.type === 'named_node') {
            return 'named';
        } else if (value.type === 'anonymous_node') {
            return 'literal';
        }
        return;
    }
}

function lintFieldValue(name: FieldName, value: TSNode, fieldInfo: CheckableSubnode, enclosing?: CheckableNamed): LintResult {
    //
    const kind: SubnodeKind | undefined = SubnodeKind.fromValue(value);
    if (!kind) {
        return;
    }
    const named: boolean = kind === 'named';
    // const nameField: TSNode | undefined = value.childrenForFieldName('name').filter(isNotNullish).at(0);
    const nameField: TSNode | undefined = Identifier.ofNode(value);
    const pool: Set<TypeName | Literal> = named ? fieldInfo.typeNames : fieldInfo.literals;
    const canBeKind: boolean = !!pool.size;
    if (!nameField) {
        return canBeKind //
            ? undefined
            : DiagnosticError(value, `Field '${name}' has no ${kind} values`);
    }

    const isWildcard: boolean = !nameField.isNamed;
    if (isWildcard && !canBeKind) {
        const _ = named ? '(_)' : '_';
        return DiagnosticError(nameField, `Invalid field value '${_}' - field '${name}' has no ${kind} values`);
    }
    // const valueName: string = named ? nameField.text : nameField.firstNamedChild?.text ?? '';
    const valueName: TypeName = TypeName.fromNode(value, nameField);
    if (!canBeKind) {
        const text: string = named //
            ? `(${valueName})`
            : `"${valueName}"`;
        return DiagnosticError(nameField, `Invalid field value ${text} - field '${name}' has no ${kind} values`);
    }
    if (!isWildcard && !pool.has(valueName)) {
        const valueText: string = named //
            ? `'(${valueName})'`
            : `"${valueName}"`;
        return DiagnosticError(nameField, `Invalid value ${valueText} for field '${name}'`);
    }
    return;
}

function flattenFieldValues(subnode: TSNode): TSNode[] {
    switch (subnode.type) {
        case 'named_node':
        case 'anonymous_node':
            return [subnode];
        case 'list':
        case 'grouping':
            return subnode.namedChildren.filter(isNotNullish).flatMap(flattenSubnode);
        default:
            return [];
    }
}
