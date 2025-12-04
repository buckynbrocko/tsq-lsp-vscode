// import from './Definition';
import { Definition, FieldDefinition, NamedNode } from './Definition';
import { DefinitionChild } from './DefinitionChild';
import { KindaTerminal, PseudoTerminal } from './Terminality';

export type Issue =
    | NonDescript
    | InvalidNode
    | UnexpectedChildNode
    | UnexpectedFieldValueChild
    | InvalidChildNode
    | InvalidNamedNodeFieldName
    | InvalidNamedNodeFieldValue
    | InvalidFieldValue
    | InvalidField;
export namespace Issue {
    export function fromInvalidNode(node: KindaTerminal<DefinitionChild>, parent?: Definition): Issue {
        switch (node.nodeType) {
            case 'field_definition':
                if (!!parent && parent instanceof NamedNode) {
                    return new InvalidNamedNodeFieldName(node, parent);
                }
                return new InvalidField(node);
            case 'named_node':
            case 'anonymous_node':
            case 'missing_node':
            case '.':
                if (!!parent) {
                    return new InvalidChildNode(node, parent);
                }
                return new InvalidNode(node);
        }
    }

    export function fromUnexpectedNode(child: KindaTerminal<DefinitionChild>, parent?: PseudoTerminal<Definition>): Issue {
        if (parent instanceof FieldDefinition) {
            return new UnexpectedFieldValueChild(child, parent);
        }
        if (parent) {
            return new UnexpectedChildNode(child, parent);
        }
        return new UnexpectedNode(child);
    }
}

export abstract class IssueABC {
    abstract summary(): string;

    get asIssue(): Issue {
        return this as unknown as Issue;
    }

    toString(): string {
        return this.summary();
    }

    withinArray(): IssueABC[] {
        return [this];
    }

    get asArray(): IssueABC[] {
        return this.withinArray();
    }
}

export class NonDescript extends IssueABC {
    constructor(readonly context?: any) {
        super();
    }

    summary(): string {
        return this.context !== undefined ? `${this.context}` : 'NonDescriptIssue';
    }
}

export class InvalidNode extends IssueABC {
    constructor(readonly node: DefinitionChild) {
        super();
    }

    summary(): string {
        return `Invalid node \`${this.node.format()}\` - Grammar has no such node`;
    }
}

export class UnexpectedNode extends IssueABC {
    constructor(readonly node: DefinitionChild) {
        super();
    }

    summary(): string {
        return `Unexpected node \`${this.node.format()}\``;
    }
}

export class UnexpectedChildNode extends IssueABC {
    constructor(readonly child: KindaTerminal<DefinitionChild>, readonly parent: PseudoTerminal<DefinitionChild>) {
        super();
    }

    summary(): string {
        return `Unexpected child \`${this.child.format()}\` for parent \`${this.parent.format()}\``;
    }
}

export class UnexpectedFieldValueChild extends IssueABC {
    constructor(readonly child: DefinitionChild, readonly field: FieldDefinition) {
        super();
    }

    summary(): string {
        return `Unexpected value child \`${this.child.format()}\` for field \`${this.field.format()}\``;
    }
}

export class InvalidChildNode extends IssueABC {
    constructor(readonly child: DefinitionChild, readonly parent: Definition) {
        super();
    }

    summary(): string {
        return `Invalid child \`${this.child.format()}\` on parent \`${this.parent.format()}\``;
    }
}

abstract class FieldIssue extends IssueABC {
    abstract field: FieldDefinition;
    get name(): string {
        return this.field.name;
    }

    get value(): Definition | undefined {
        return this.field.value;
    }
}

export class InvalidNamedNodeFieldName extends FieldIssue {
    constructor(readonly field: FieldDefinition, readonly namedNode: NamedNode) {
        super();
    }

    summary(): string {
        return `Invalid field "${this.name}" - \`${this.namedNode.format()}\` has no such field`;
    }
}
export class InvalidNamedNodeFieldValue extends FieldIssue {
    constructor(readonly field: FieldDefinition, readonly namedNode: NamedNode) {
        super();
    }

    summary(): string {
        return `Invalid value for field "${this.name}" on  \`${this.namedNode.name}\`: \`${this.value?.format()}\``;
    }
}

export class InvalidFieldValue extends FieldIssue {
    constructor(readonly field: FieldDefinition) {
        super();
    }

    summary(): string {
        return `Invalid value for field "${this.name}": \`${this.value?.format()}\``;
    }
}

export class InvalidField extends FieldIssue {
    constructor(readonly field: FieldDefinition) {
        super();
    }

    summary(): string {
        return `Invalid field "${this.name}" - Grammar has no such field;`;
    }
}
