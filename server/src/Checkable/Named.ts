import * as lsp from 'vscode-languageserver';
import { markupCode } from '../completions/completions';
import { Dict } from '../Dict';
import { HasSignatureAndFields } from '../Documentable';
import { Leaf, Named, NodeType, Parent } from '../node_types';
import { FieldName, Literal, TypeName } from '../typeChecking';
import { CheckableFields, CheckableSubnode } from './Subnode';
import { SupertypeMap } from './Supertype';

export class CheckableNamed extends HasSignatureAndFields {
    constructor(
        public type: TypeName,
        public named: true = true,
        public literals = new Set<Literal>(),
        public typeNames = new Set<TypeName>(),
        public fields = new Dict<FieldName, CheckableSubnode>(),
        public children?: CheckableSubnode,
        public root?: boolean,
        public extra?: boolean
    ) {
        super();
        // super(typeNames, literals);
        // this.type = type;
        // this.fields = fields;
        // this.children = children;
        // this.root = root;
        // this.extra = extra;
    }

    static fromTypeAndSupertypes(type: Named<Leaf> | Parent, supertypeMap: SupertypeMap): CheckableNamed {
        let branch = new CheckableNamed(type.type);
        if (NodeType.isBranch(type)) {
            if (!!type.children) {
                let children: CheckableSubnode = CheckableSubnode.fromChildAndSupertypeMap(type.children, supertypeMap);
                branch.addLiterals(...children.literals);
                branch.addTypeNames(...children.typeNames);
                branch.children = children;
            }
            let fields = CheckableFields(type.fields, supertypeMap);
            if (!!fields) {
                fields.forEachValue(field => {
                    branch.addLiterals(...field.literals);
                    branch.addTypeNames(...field.typeNames);
                });
                branch.fields = fields;
            }
        }
        if (type.root) {
            branch.root = true;
        }
        if (type.extra) {
            branch.extra = true;
        }
        return branch;
    }

    get fieldNames(): Set<FieldName> {
        return new Set(this.fields.keysArray());
    }

    // get hasFields(): boolean {
    //     return !!this.fields.size;
    // }

    get documentation(): lsp.MarkupContent {
        const signature: string = this.signatureString();
        // const value = PREFIX + signature + SUFFIX;
        let content: lsp.MarkupContent = markupCode(signature);
        if (this.extra) {
            content.value += '\n `Extra`\n';
        }
        if (this.root) {
            content.value += '\n `Root`\n';
        }
        return content;
    }

    // getField(name?: FieldName): CheckableSubnode | undefined;
    // getField(name: undefined): undefined;
    // getField(name?: FieldName): CheckableSubnode | undefined {
    //     return this.fields.get(name as FieldName);
    // }

    signature(indentation: string = '\t') {
        return markupCode(this.signatureString(indentation));
    }

    signatureString(indentation: string = '\t'): string {
        const fieldSignatures: string[] = this.fields.map(([name, info]) => info.fieldSignatureString(name));
        const childrenSignatures: string[] = !!this.children ? [this.children.signatureString()] : [];
        const subnodeSignatures: string[] = [...fieldSignatures, ...childrenSignatures].map(
            signature => indentation + signature
        );

        if (!subnodeSignatures.length) {
            return `(${this.type})`;
        }

        const lines: string[] = [`(${this.type}`, ...subnodeSignatures, `${indentation})`];
        const signature: string = lines.join('\n');

        return signature;
    }
}

export type CheckableNamedMap = Dict<TypeName, CheckableNamed>;
export namespace CheckableNamedMap {
    export function create(named: Named<NodeType>[], supertypeMap: SupertypeMap): CheckableNamedMap {
        return new Dict(named.map(type => CheckableNamed.fromTypeAndSupertypes(type, supertypeMap)).map(cn => [cn.type, cn]));
    }
}
