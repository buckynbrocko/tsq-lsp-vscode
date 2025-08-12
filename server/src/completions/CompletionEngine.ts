import * as lsp from 'vscode-languageserver';
import { CheckableSubnode } from '../Checkable/Subnode';
import { Capture, Captures } from '../TreeSitter';
import { FieldName, Literal, TypeName } from '../typeChecking';
import { TypeEnvironment } from '../TypeEnvironment';
import { ALL, CompletionContext, TSQCompletionContext } from './completions';

type CompletionCache<K extends PropertyKey = PropertyKey, V extends lsp.CompletionItem = lsp.CompletionItem> = Record<K, V[]>;
type Completions<C> = C extends CompletionCache<infer K, infer V> ? C : never;
export interface TSQCompletions {
    nodes: (lsp.CompletionItem & { label: TypeName })[];
    nodesTransformed: (lsp.CompletionItem & { label: TypeName })[];
    fieldNames: (lsp.CompletionItem & { label: FieldName })[];
    fieldNamesTransformed: lsp.CompletionItem[];
    literals: lsp.CompletionItem[];
    builtins: lsp.CompletionItem[];
}
export function TSQCompletions(completions: Partial<TSQCompletions> = {}) {
    return {
        ...completions,
        nodes: [],
        nodesTransformed: [],
        fieldNames: [],
        fieldNamesTransformed: [],
        literals: [],
        builtins: [],
    };
}

type Handles<CTX extends CompletionContext = never, OPT = {}> = {
    // [Property in CTX['type']]: (context: CTX, environment: TypeEnvironment, { ...optionals }: OPT) => lsp.CompletionItem[];
    // [Property in CTX['type']]: HandlerFunction<CTX, Property, OPT>;
    [Property in CTX['type']]: (
        context: ContextWithName<CTX, Property>,
        environment: TypeEnvironment,
        optionals?: OPT
    ) => lsp.CompletionItem[];
    // [Property in CTX['type']]: HandlerFunction<CTX, CTX[Property] extends infer I & {type: Property} ? I : never, OPT>;
};
type HandlerArgs<CTX extends CompletionContext = never, T extends CTX['type'] = CTX['type'], OPT = {}> = {
    context: ContextWithName<CTX, T>;
    environment: TypeEnvironment;
    optionals: OPT;
};

type ContextWithName<C extends CompletionContext, N extends C['type']> = { type: N } & C extends infer I ? I : never;
let hmm: ContextWithName<TSQCompletionContext, 'capture'>;

type HandlerFunction<C extends CompletionContext = never, T extends C['type'] = C['type'], OPT = {}> = (
    context: ContextWithName<C, T>,
    environment: TypeEnvironment,
    optionals?: Partial<OPT>

    // { context, environment, optionals }:
    // HandlerArgs<C, T, OPT>
    // {
    //         context: ContextWithName<C, T>,
    //         environment: TypeEnvironment,
    //         optionals?: OPT
    //     }
) => lsp.CompletionItem[];

export type TSQContext<T extends TSQCompletionContext['type']> = ContextWithName<TSQCompletionContext, T>;

type ContextTypes<C extends CompletionContext> = C['type'];
type ContextKeys<C extends CompletionContext> = keyof Handles<C>;
type TSQContextKeys = ContextKeys<TSQCompletionContext>;

type TSQArgs<T extends TSQCompletionContext['type'] = TSQCompletionContext['type'], OPT = {}> = HandlerArgs<
    TSQCompletionContext,
    T,
    OPT
>;
// type TSQOptionalArgs = Partial<TSQArgs>;
type TSQOptionalArgs = Partial<{ captures: Capture.Map }>;

type hmm = Handles<TSQCompletionContext>;

export class TSQCompletionEngine implements Handles<TSQCompletionContext, TSQOptionalArgs> {
    cache: TSQCompletions = TSQCompletions({ builtins: ALL });
    getHandler<T extends TSQContextKeys>(name: T): HandlerFunction<TSQCompletionContext, T, TSQOptionalArgs> {
        return this[name] as HandlerFunction<TSQCompletionContext, T, TSQOptionalArgs>;
    }

    none(context: TSQContext<'none'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}): lsp.CompletionItem[] {
        return [];
    }

    unhandled(context: TSQContext<'unhandled'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        return [...this.cache.nodes, ...this.cache.builtins, ...this.cache.fieldNames, ...this.cache.literals];
    }

    capture(context: TSQContext<'capture'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        if (!optionals.captures) {
            return [];
        }

        let completionNames: string[] = optionals.captures.keysArray();
        if (Captures.isOnlyInstanceOfName(optionals.captures, context.identifier)) {
            completionNames = completionNames.filter(name => name !== context.identifier);
        }
        const captureCompletions: lsp.CompletionItem[] = completionNames.map(name => {
            return { label: name };
        });
        return captureCompletions;
    }
    node(context: TSQContext<'node'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        return context.transform ? [...this.cache.nodesTransformed, ...this.cache.literals] : [...this.cache.nodes];
    }
    child(context: TSQContext<'child'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        let [nodeCompletions, fieldCompletions] = context.transform
            ? [this.cache.nodesTransformed, this.cache.fieldNamesTransformed]
            : [this.cache.nodes, this.cache.fieldNames];
        let literalCompletions = this.cache.literals;

        // console.debug(`Enclosing Type: ${completionContext.enclosingNodeType}`);
        let enclosingType = environment.getNamed(context.enclosingNodeType);
        if (!!enclosingType) {
            // enclosingType.fields && console.debug(`Fields: ${[...enclosingType.fields.keys()]}`);
            fieldCompletions = fieldCompletions.filter(item => enclosingType.fields.has(item.label as FieldName));
            nodeCompletions = nodeCompletions.filter(item => enclosingType.typeNames.has(item.label as TypeName));
            literalCompletions = literalCompletions.filter(item =>
                enclosingType.literals.has(Literal.dequote(item.label) as Literal)
            );
        } else {
            console.debug(`Failed to find type info for enclosing type '${context.enclosingNodeType}'`);
        }

        return [...nodeCompletions, ...fieldCompletions, ...literalCompletions];
    }

    empty_string(context: TSQContext<'empty_string'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        console.debug();
        console.debug('PEEPEE POOPOO');
        let literalCompletions = this.cache.literals.map(item => {
            return {
                ...item,
                label: Literal.dequote(item.label) as Literal,
            } satisfies lsp.CompletionItem;
        });
        const parentType = environment.getNamed(context.parentType);
        const fieldName = context.fieldName;
        const fieldInfo = !!parentType ? parentType.getField(fieldName) : environment.getField(fieldName);
        if (!!fieldInfo) {
            literalCompletions = literalCompletions.filter(item => fieldInfo.literals.has(item.label));
        } else if (!!parentType) {
            literalCompletions = literalCompletions.filter(item => parentType.literals.has(item.label));
        }
        return literalCompletions;
    }
    field_value(context: TSQContext<'field_value'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        let fieldValues = context.transform ? this.cache.nodesTransformed : this.cache.nodes;
        const field: CheckableSubnode | undefined = environment.getNamed(context.parentType)?.fields?.get(context.fieldName);
        let literalValues = this.cache.literals;
        if (!!field) {
            // console.debug('found field info');
            fieldValues = fieldValues.filter(item => field.hasTypeName(item.label));
            literalValues = literalValues.filter(item => field.hasLiteral(Literal.dequote(item.label)));
        }
        return [...fieldValues, ...literalValues];
    }
    field_name(context: TSQContext<'field_name'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        const fieldNames = environment.getNamed(context.parentType)?.fields?.keysArray();
        if (!fieldNames) {
            return this.cache.fieldNames;
        }
        const fieldCompletions = this.cache.fieldNames.filter(item => fieldNames.includes(item.label as FieldName));
        return fieldCompletions;
    }
    negated_field(context: TSQContext<'negated_field'>, environment: TypeEnvironment, optionals: TSQOptionalArgs = {}) {
        !!context.parentType && console.debug(`parentType: ${context.parentType}`);
        const fieldNames: string[] | undefined = environment.getNamed(context.parentType)?.fields?.keysArray();
        const negatedCompletions: lsp.CompletionItem[] = !fieldNames
            ? this.cache.fieldNames
            : fieldNames.map(name => {
                  return {
                      label: name,
                  } satisfies lsp.CompletionItem;
              });
        return negatedCompletions;
    }

    run<T extends TSQContextKeys>(
        context: TSQContext<T>,
        environment: TypeEnvironment,
        optionals: Partial<TSQOptionalArgs> = {}
    ): lsp.CompletionList | null {
        // let handler: HandlerFunction<TSQCompletionContext, T, TSQOptionalArgs> = this.getHandler(context.type);
        // handler.bind(this);
        // if (!handler) {
        //     return null;
        // }
        let completions = (this[context.type] as HandlerFunction<TSQCompletionContext, T, TSQOptionalArgs>)(
            context,
            environment,
            optionals
        );
        return lsp.CompletionList.create(completions, false);
    }
}
