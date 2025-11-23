// import { Node as TSNode } from 'web-tree-sitter';
import {
    hasPropertiesOfTypes,
    hasPropertyOfType,
    isArrayOf,
    isBoolean,
    isRecordOf,
    isString,
    lacksOrHasPropertyOfType,
} from './predicates';
import { TSNode } from './reexports';
import { FieldName, Literal, TypeName } from './typeChecking';

export type NodeType = Leaf | NodeInfo;
export type NodeTypes = NodeType;
export type NodeInfo = Supertype | Parent;

export type Root<T> = T & { root: true };
export type Extra<T> = T & { extra: true };
export type Named<T> = T extends Common
    ? T & { named: true; type: TypeName }
    : T extends TSNode
    ? T & { isNamed: true; type: TypeName }
    : never;
export type Unnamed<T extends Common> = T & { named: false; type: Literal };
export type LiteralNode = Unnamed<Common> & { type: Literal };

export type HasSubtypes<T> = T & { subtypes: Common[] };

export type HasFields<T> = T & { fields: { [name: FieldName]: Children } };
export type HasChildren<T> = T & { children: Children };

export type SubNode = {
    multiple: boolean;
    required: boolean;
    types: Common[];
};

export type Stub = {
    type: TypeName | Literal;
    named: boolean;
};

export type Common = Stub & {
    root?: true;
    extra?: true;
};

export type Leaf = Exclude<Common, Parent & Supertype>;

export type Supertype = Named<Common> & {
    subtypes: Common[];
};

export type Parent = Named<Common> & {
    fields: Fields;
    children?: Children;
};

export type Field = Children;
export type Fields = { [name: FieldName]: Field };

export type Children = {
    multiple: boolean;
    required: boolean;
    types: Stub[];
};

export namespace NodeType {
    export function isStub(object: any): object is Stub {
        return hasPropertyOfType(object, 'named', isBoolean) && hasPropertyOfType(object, 'type', isString);
    }

    export function isCommon(object: any): object is Common {
        return isStub(object) && _isCommon(object);
    }

    export function isSupertype(object: any): object is Supertype {
        return isCommon(object) && hasPropertyOfType(object, 'subtypes', isArrayOf(isStub));
    }

    export function isBranch(object: any): object is Parent {
        return isCommon(object) && hasPropertyOfType(object, 'fields', isFields);
    }

    // export function isParent<T>(info: T): info is T & Parent {
    //     return isLeaf(info) && (hasProperty(info, 'children', isChildren) || hasProperty(info, 'fields', isFields));
    // }

    export function isSubNode(object: any): object is SubNode {
        return (
            hasPropertyOfType(object, 'multiple', isBoolean) &&
            hasPropertyOfType(object, 'required', isBoolean) &&
            hasPropertyOfType(object, 'types', isArrayOf(isStub))
        );
    }

    export function isLeaf(object: any): object is Common {
        return (
            typeof object.type === 'string' && //
            typeof object.named === 'boolean'
        );
    }

    export function isChildren(object: any): object is Children {
        return (
            typeof object.multiple === 'boolean' && //
            typeof object.required === 'boolean' &&
            isArrayOf(object.types, isLeaf)
        );
    }

    export function isNamed(type: Stub): type is Named<typeof type> {
        return !!type.named;
    }

    export function isLiteral(type: Stub): type is LiteralNode {
        return !type.named;
    }

    export function isRoot(type: Common): type is Root<typeof type> {
        return !!type.root;
    }

    export function isExtra(type: Common): type is Extra<typeof type> {
        return !!type.root;
    }

    export function isFields(object: any): object is typeof object & { [name: string]: Children } {
        return isRecordOf(object, isChildren);
    }

    export function hasFields(type: NodeType): type is HasFields<typeof type> {
        return 'fields' in type && !!Object.entries(type.fields).length;
    }

    export function isNotHidden(nodeType: NodeType): boolean {
        return !isHidden(nodeType);
    }

    export function isHidden(nodeType: NodeType): boolean {
        return !nodeType.named || nodeType.type.startsWith('_');
    }
}

export namespace NodeTypes {
    export function fromString(text: string): NodeType[] {
        try {
            let info: any = JSON.parse(text);
            if (isArrayOf(info, NodeType.isLeaf)) {
                return info;
            }
        } catch (error) {
            console.error(error);
            console.error('Failed to marshal object from JSON string');
        }
        return [];
    }

    export class Categorized {
        supertypes: Supertype[] = [];
        named: Named<NodeType>[] = [];
        literals: LiteralNode[] = [];
        branches: Parent[] = [];
        leaves: Leaf[] = [];
        namedLeaves: Named<Leaf>[] = [];
        all: NodeType[];

        static empty(): Categorized {
            return new Categorized([]);
        }

        constructor(types: NodeType[]) {
            this.all = types;
            for (let type of types) {
                if (NodeType.isLiteral(type)) {
                    this.literals.push(type);
                    this.leaves.push(type);
                } else if (NodeType.isSupertype(type)) {
                    this.supertypes.push(type);
                } else if (NodeType.isNamed(type)) {
                    this.named.push(type);
                    if (NodeType.isBranch(type)) {
                        this.branches.push(type);
                    } else {
                        this.leaves.push(type);
                        this.namedLeaves.push(type);
                    }
                } else {
                    console.error(`Type '${type.type}' fell through during categorization`);
                }
            }
        }
    }

    export function compare(a: Common, b: Common) {
        if (a.named !== b.named) {
            return a.named ? 1 : -1;
        }
        return a.type.localeCompare(b.type);
    }

    export function sort(nodes: Common[]) {
        return nodes.sort(compare);
    }

    export function allFieldNames(types: NodeType[]): Set<FieldName> {
        return new Set(types.filter(NodeType.hasFields).flatMap(type => Object.keys(type.fields)) as FieldName[]);
    }
}

export namespace SubNode {
    export function is(object: any): object is typeof object & SubNode {
        return hasPropertiesOfTypes(object, {
            multiple: isBoolean,
            required: isBoolean,
            types: isArrayOf(NodeType.isLeaf),
        });
        // return (
        //     hasPropertyOfType(object, 'multiple', isBoolean) &&
        //     hasPropertyOfType(object, 'required', isBoolean) &&
        //     isArrayOf(object.types, isLeaf)
        // );
    }
}

function _isCommon(stub: Stub): stub is Common {
    return lacksOrHasPropertyOfType(stub, 'extra', isBoolean) && lacksOrHasPropertyOfType(stub, 'root', isBoolean);
}
