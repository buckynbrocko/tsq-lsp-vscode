export enum Terminality {
    Terminal = 'Terminal',
    PseudoTerminal = 'PseudoTerminal',
    NonTerminal = 'NonTerminal',
}

type AsTerminality<Obj extends HasTerminalityOf, Term extends Terminality> = Obj extends HasSpecificTerminality<Term>
    ? Obj
    : undefined;
type AsTerminal<T extends HasTerminalityOf> = AsTerminality<T, Terminality.Terminal>;
type AsPseudoTerminal<T extends HasTerminalityOf> = AsTerminality<T, Terminality.PseudoTerminal>;
type AsNonTerminal<T extends HasTerminalityOf> = AsTerminality<T, Terminality.NonTerminal>;
type AsKindaTerminal<T extends HasTerminalityOf> =
    | AsTerminality<T, Terminality.Terminal>
    | AsTerminality<T, Terminality.PseudoTerminal>;
type AsKindaNonTerminal<T extends HasTerminalityOf> =
    | AsTerminality<T, Terminality.NonTerminal>
    | AsTerminality<T, Terminality.PseudoTerminal>;

export abstract class HasTerminality implements HasTerminalityOf {
    abstract readonly terminality: Terminality;

    get asTerminal(): Terminal<typeof this> | undefined {
        return (this.isTerminal() ? this : undefined) as Terminal<typeof this> | undefined;
    }

    get asPseudoTerminal(): PseudoTerminal<typeof this> | undefined {
        return (this.isPseudoTerminal() ? this : undefined) as PseudoTerminal<typeof this> | undefined;
    }

    get asNonTerminal(): NonTerminal<typeof this> | undefined {
        return (this.isNonTerminal() ? this : undefined) as NonTerminal<typeof this> | undefined;
    }

    get asKindaTerminal(): KindaTerminal<typeof this> | undefined {
        return (this.isKindaTerminal() ? this : undefined) as KindaTerminal<typeof this> | undefined;
    }

    get asKindaNonTerminal(): KindaNonTerminal<typeof this> | undefined {
        return (this.isKindaNonTerminal() ? this : undefined) as KindaNonTerminal<typeof this> | undefined;
    }

    isTerminal(): this is Terminal<typeof this> {
        return this.terminality === Terminality.Terminal;
    }

    isPseudoTerminal(): this is PseudoTerminal<typeof this> {
        return this.terminality === Terminality.PseudoTerminal;
    }

    isNonTerminal(): this is NonTerminal<typeof this> {
        return this.terminality === Terminality.NonTerminal;
    }

    isKindaTerminal(): this is KindaTerminal<typeof this> {
        return this.terminality !== Terminality.NonTerminal;
    }

    isKindaNonTerminal(): this is KindaNonTerminal<typeof this> {
        return this.terminality !== Terminality.Terminal;
    }
}
export type HasTerminalityProperty = { terminality: Terminality };
export type WithTerminality<Type, Term extends Terminality> = Type & HasSpecificTerminality<Term>;
export type HasSpecificTerminality<T extends Terminality> = { terminality: T };
export type HasTerminalityOf<T extends Terminality = Terminality> = { terminality: T };

export type Terminal<T> = Extract<T, { terminality: Terminality.Terminal }>;
export type PseudoTerminal<T> = Extract<T, { terminality: Terminality.PseudoTerminal }>;
export type NonTerminal<T> = Extract<T, { terminality: Terminality.NonTerminal }>;

export type KindaTerminal<T> = Terminal<T> | PseudoTerminal<T>;
export type KindaNonTerminal<T> = NonTerminal<T> | PseudoTerminal<T>;

export namespace Terminality {
    const ALL: Terminality[] = [Terminality.Terminal, Terminality.PseudoTerminal, Terminality.NonTerminal];

    export function is(arg: any): arg is Terminality {
        return ALL.includes(arg);
    }

    export function isTerminal<T extends HasTerminalityOf>(object: T): object is Terminal<T> {
        return object.terminality === Terminality.Terminal;
    }
    export function isPseudoTerminal<T extends HasTerminalityOf>(object: T): object is PseudoTerminal<T> {
        return object.terminality === Terminality.PseudoTerminal;
    }
    export function isNonTerminal<T extends HasTerminalityOf>(object: T): object is NonTerminal<T> {
        return object.terminality === Terminality.NonTerminal;
    }
    export function isKindaTerminal<T extends HasTerminalityOf>(object: T): object is KindaTerminal<T> {
        return isTerminal(object) || isPseudoTerminal(object);
    }
    export function isKindaNonTerminal<T extends HasTerminalityOf>(object: T): object is KindaNonTerminal<T> {
        return isNonTerminal(object) || isPseudoTerminal(object);
    }
}
