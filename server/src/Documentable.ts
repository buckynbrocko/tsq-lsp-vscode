import { MarkupContent } from 'vscode-languageserver';
import { CheckableSubnode } from './Checkable/Subnode';
import { markupCode } from './completions/completions';
import { Dict } from './Dict';
import { FieldName, Literal, Parenthesized, QuotedLiteral, TypeName, unionString } from './typeChecking';

export type HasTypeNamesProperty = { typeNames: Set<TypeName> };
export type HasLiteralsProperty = { typeNames: Set<Literal> };

export abstract class HasSignature {
    abstract get literals(): Set<Literal>;
    abstract get typeNames(): Set<TypeName>;

    get isEmpty(): boolean {
        return !this.hasSubnodes;
    }

    get hasSubnodes(): boolean {
        return this.hasLiterals || this.hasNamed;
    }

    get hasLiterals(): boolean {
        return !!this.literals.size;
    }

    get hasNamed(): boolean {
        return !!this.typeNames.size;
    }

    hasTypeName(name: TypeName): boolean {
        return this.typeNames.has(name);
    }

    hasLiteral(literal: Literal): boolean {
        return this.literals.has(literal);
    }

    get literalsArray(): Literal[] {
        return [...this.literals];
    }
    get typeNamesArray(): TypeName[] {
        return [...this.typeNames];
    }
    get quotedLiterals(): QuotedLiteral[] {
        return this.literalsArray.map(Literal.quote);
    }
    get parenthesizedTypeNames(): Parenthesized[] {
        return this.typeNamesArray.map(TypeName.parenthesize);
    }
    subsignature(): MarkupContent {
        return markupCode(this.subsignatureString());
    }
    subsignatureString(): string {
        return unionString([
            ...this.quotedLiterals,
            ...this.parenthesizedTypeNames,
            //
        ]);
    }
    literalSignature(): MarkupContent {
        return markupCode(this.literalSignatureString());
    }
    literalSignatureString(): string {
        return unionString(this.quotedLiterals);
    }
    namedSignature(): MarkupContent {
        return markupCode(this.namedSignatureString());
    }

    namedSignatureString(): string {
        return unionString(this.parenthesizedTypeNames);
    }

    addLiterals(...literals: string[]) {
        literals.forEach(literal => this.literals.add(literal as Literal));
    }

    addTypeNames(...typeNames: TypeName[]) {
        typeNames.forEach(typeName => this.typeNames.add(typeName));
    }
}

export abstract class HasSignatureAndFields extends HasSignature {
    abstract get fields(): Dict<FieldName, CheckableSubnode>;

    getField(name: undefined): undefined;
    getField(name?: FieldName): CheckableSubnode | undefined;
    getField(name?: FieldName): CheckableSubnode | undefined {
        return !!name ? this.fields.get(name) : undefined;
    }

    get fieldNames(): Set<FieldName> {
        return new Set(this.fields.keys());
    }

    get hasSubnodes(): boolean {
        return this.hasLiterals || this.hasNamed || this.hasFields;
    }

    get hasFields(): boolean {
        return !!this.fieldNames.size;
    }

    hasField(name?: FieldName): boolean {
        return !!name && this.fieldNames.has(name);
    }
}
