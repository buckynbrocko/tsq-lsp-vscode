import { CheckableNamed, CheckableNamedMap } from './Checkable/Named';
import { CheckableFieldMap, CheckableSubnode } from './Checkable/Subnode';
import { CheckableSupertype, SupertypeMap } from './Checkable/Supertype';
import { Dict } from './Dict';
import { HasSignatureAndFields } from './Documentable';
import { NodeType, NodeTypes } from './node_types';
import { isNotNullish } from './predicates';
import { FieldName, Literal, TypeName } from './typeChecking';

export class TypeEnvironment extends HasSignatureAndFields {
    private constructor(
        public literals: Set<Literal>,
        public types: Dict<TypeName, CheckableNamed>,
        public fields: Dict<FieldName, CheckableSubnode>,
        // public typeNames: Set<TypeName>,
        // public fieldNames: Set<FieldName>,
        public supertypeMap: Dict<TypeName, CheckableSupertype>
    ) {
        super();
    }

    get typeNames(): Set<TypeName> {
        return new Set(this.types.keys());
    }

    static empty(): TypeEnvironment {
        // return new TypeEnvironment(new Set(), new Dict(), new Dict(), new Set(), new Set(), new Dict());
        return new TypeEnvironment(new Set(), new Dict(), new Dict(), new Dict());
    }

    static fromNodeTypes(types: NodeType[]): TypeEnvironment {
        let categorized = new NodeTypes.Categorized(types);
        return TypeEnvironment.fromCategorizedNodeTypes(categorized);
    }
    static fromCategorizedNodeTypes(categorized: NodeTypes.Categorized): TypeEnvironment {
        const supertypeMap = SupertypeMap.fromCategorizedTypes(categorized);
        const literals = new Set(categorized.literals.map(literal => literal.type));
        const types = CheckableNamedMap.create(categorized.named, supertypeMap);
        // const typeNames = new Set(categorized.named.map(named => named.type));
        const fields = CheckableFieldMap.create(types.valuesArray());
        // const fieldNames = new Set(types.valuesArray().flatMap(n => n.fields.keysArray()));

        return new TypeEnvironment(literals, types, fields, supertypeMap);
    }

    getNamed(name: undefined): undefined;
    getNamed(name: TypeName): CheckableNamed | undefined;
    getNamed(name: TypeName | undefined): CheckableNamed | undefined;
    getNamed(name?: TypeName): CheckableNamed | undefined {
        return !!name ? this.types.get(name) : undefined;
    }

    // getField(name: undefined): undefined;
    // getField(name?: FieldName): CheckableSubnode | undefined;
    // getField(name?: FieldName): CheckableSubnode | undefined {
    //     if (!name) {
    //         return;
    //     }
    //     let fields = this.getFieldsForName(name);
    //     if (!fields.length) {
    //         return;
    //     }
    //     let typeNames = new Set(fields.flatMap(f => [...f.typeNames]));
    //     let literals = new Set(fields.flatMap(f => [...f.literals]));
    //     if (!!typeNames.size || !!literals.size) {
    //         return new CheckableSubnode(false, true, typeNames, literals);
    //     }
    // }

    getFieldsForName(name: FieldName): CheckableSubnode[] {
        return this.types
            .valuesArray()
            .map(ct => ct.fields.get(name))
            .filter(isNotNullish);
    }
}
