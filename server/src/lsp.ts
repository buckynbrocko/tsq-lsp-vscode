import { readFile } from 'fs';
import * as path from 'path';
import * as lsp from 'vscode-languageserver';
import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import * as wts from 'web-tree-sitter';
import { CheckableSubnode } from './Checkable/Subnode';
import { TSQCompletionEngine } from './completions_/CompletionEngine';
import { ALL, closestAncestorOfType, TSQCompletionContext } from './completions_/completions';
import { Dict } from './Dict';
import { _formatTree, Identifier, LSPRange, TSNode } from './junk_drawer';
import { lintAll } from './lints';
import { NodeType, NodeTypes } from './node_types';
import { isType } from './predicates';
import * as Token from './Token';
import { Capture, Captures, TreeSitter } from './TreeSitter';
import { FieldName, Literal, TypeName } from './typeChecking';
import { TypeEnvironment } from './TypeEnvironment';

export class LSPServer {
    private connection: lsp.Connection;
    private resourcesPath: string;
    tree_sitter = new TreeSitter();
    typeEnvironment = TypeEnvironment.empty();
    workspace?: lsp.WorkspaceFolder;
    documents: lsp.TextDocuments<TextDocument> = new lsp.TextDocuments(TextDocument);
    nodeTypes: NodeType[] = [];
    DEBUG: boolean = true;
    treeCache: Dict<DocumentUri, wts.Tree> = new Dict();
    captureMapCache: Dict<DocumentUri, Capture.Map> = new Dict();

    supports = {
        workspaceFolders: false,
    };
    completionEngine = new TSQCompletionEngine();

    completions = {
        nodes: [] as (lsp.CompletionItem & { label: TypeName })[],
        nodesTransformed: [] as (lsp.CompletionItem & { label: TypeName })[],
        fieldNames: [] as (lsp.CompletionItem & { label: FieldName })[],
        fieldNamesTransformed: [] as lsp.CompletionItem[],
        literals: [] as lsp.CompletionItem[],
        builtins: ALL,
    };

    constructor(connection: lsp.Connection, resourcesPath: string) {
        this.connection = connection;
        this.resourcesPath = resourcesPath;
        // this.scheduledParser = new TreeThingy();
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
        // this.connection.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this));

        this.connection.onHover(this.onHover.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onExecuteCommand(this.onExecuteCommand.bind(this));
        this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
        // Object. this. typeof'onDocumentSymbol' in this && this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
        this.connection.languages.semanticTokens.on(this.onSemanticTokensFull.bind(this));
        this.documents.listen(this.connection);
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onInitialized(this.onInitialized.bind(this));
        this.initializeParser();
    }

    debug(argument: any, ...optionalParams: any[]): void {
        if (this.DEBUG) {
            console.debug(argument, ...optionalParams);
        }
    }

    //#region Handlers

    onInitialize(parameters: lsp.InitializeParams): lsp.InitializeResult {
        const capabilities = parameters.capabilities;

        this.supports.workspaceFolders = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

        let result: lsp.InitializeResult = {
            capabilities: {
                documentSymbolProvider: true,
                textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
                completionProvider: {
                    triggerCharacters: ['(', '@', '#', '.', '[', '!', '"'],
                    // resolveProvider: true,
                },
                // inlineCompletionProvider: {},
                // definitionProvider: true,
                // hoverProvider: true,
                // renameProvider: { prepareProvider: true },
                // referencesProvider: true,
                // foldingRangeProvider: false,
                // workspace: { workspaceFolders: { supported: true } },
                semanticTokensProvider: {
                    documentSelector: ['tree-sitter-query'],
                    full: true,
                    range: false,

                    legend: {
                        tokenModifiers: Token.MODIFIERS,
                        tokenTypes: Token.TYPES,
                    },
                },
            },
        };
        if (this.supports.workspaceFolders) {
            result.capabilities.workspace = { workspaceFolders: { supported: true } };
        }
        if (this.onHover !== undefined) {
            result.capabilities.hoverProvider = true;
        }
        return result;
    }

    onInitialized(): void {
        if (this.supports.workspaceFolders) {
            this.connection.workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders.bind(this));

            this.connection.workspace.getWorkspaceFolders().then(folders => {
                let folder: lsp.WorkspaceFolder | undefined;
                switch (folders?.length) {
                    case null:
                    case undefined:
                    case 0:
                        console.debug('No workspace folders found');
                        break;
                    case 1:
                        folder = folders[0]!;
                        console.debug(`current workspace: "${folder.name}" @ "${folder.uri}"`);
                        this.workspace = folders[0];
                        break;
                    default:
                        folder = (folders || [undefined])[0];
                        console.debug('multiple workspace folders found');
                        break;
                }
                this.workspace = folder;
                this.loadNodeTypes();
            });
        }
    }

    async onCompletion(params: lsp.CompletionParams, cancelToken?: lsp.CancellationToken): Promise<lsp.CompletionList | null> {
        let completions: lsp.CompletionItem[] = [];
        let isIncomplete: boolean = false;

        let document = this.documents.get(params.textDocument.uri);
        if (!document) {
            completions.push(...this.completions.nodes, ...this.completions.builtins, ...this.completions.fieldNames);
            return lsp.CompletionList.create(completions, isIncomplete);
        }

        let tree = this.treeCache.get(params.textDocument.uri);
        if (!tree) {
            completions.push(
                ...this.completions.nodes,
                ...this.completions.builtins,
                ...this.completions.fieldNames,
                ...this.completions.literals
            );
            return lsp.CompletionList.create(completions, isIncomplete);
        }

        let nodeAtPosition = this.tree_sitter.node_at_position(tree, params.position);
        if (!!nodeAtPosition) {
            // console.debug(`Node at position: ${nodeAtPosition.type}`);
        }

        let context: TSQCompletionContext = TSQCompletionContext.fromTree(tree, params, this.tree_sitter);
        console.debug(`Completion Context: ${context.type}`);
        let completionMapCache = context.type === 'capture' ? this.captureMapCache.get(document.uri) : undefined;
        return this.completionEngine.run(context, this.typeEnvironment, { captures: completionMapCache });
        return completionHandler(context, this.typeEnvironment, this.completions, completionMapCache);

        // switch (context.type) {
        //     case 'none':
        //         return null;
        //     case 'unhandled':
        //         completions.push(
        //             ...this.completions.nodes,
        //             ...this.completions.builtins,
        //             ...this.completions.fieldNames,
        //             ...this.completions.literals
        //         );
        //         break;
        //     case 'empty-string':
        //         {
        //             let literalCompletions = this.completions.literals.map(item => {
        //                 return {
        //                     ...item,
        //                     label: Literal.dequote(item.label) as Literal,
        //                 } satisfies lsp.CompletionItem;
        //             });
        //             const parentType = this.typeEnvironment.getNamed(context.parentType);
        //             const fieldName = context.fieldName;
        //             const fieldInfo = !!parentType
        //                 ? parentType.getField(fieldName)
        //                 : this.typeEnvironment.getFieldComposite(fieldName);
        //             if (!!fieldInfo) {
        //                 literalCompletions = literalCompletions.filter(item => fieldInfo.literals.has(item.label));
        //             } else if (!!parentType) {
        //                 literalCompletions = literalCompletions.filter(item => parentType.literals.has(item.label));
        //             }
        //             completions.push(...literalCompletions);
        //         }

        //         break;
        //     case 'capture':
        //         const map: CaptureMap | undefined = this.captureMapCache.get(document.uri);
        //         if (!map) {
        //             return null;
        //         }

        //         let completionNames: string[] = map.keysArray();
        //         if (isOnlyInstanceOfCaptureName(map, context.identifier)) {
        //             completionNames = completionNames.filter(name => name !== context.identifier);
        //         }
        //         const captureCompletions: lsp.CompletionItem[] = completionNames.map(name => {
        //             return { label: name };
        //         });
        //         completions.push(...captureCompletions);
        //         break;
        //     case 'node':
        //         context.transform
        //             ? completions.push(...this.completions.nodesTransformed)
        //             : completions.push(...this.completions.nodes);
        //         if (context.transform) {
        //             completions.push(...this.completions.literals);
        //         }
        //         break;
        //     case 'child':
        //         let [nodeCompletions, fieldCompletions] = context.transform
        //             ? [this.completions.nodesTransformed, this.completions.fieldNamesTransformed]
        //             : [this.completions.nodes, this.completions.fieldNames];
        //         let literalCompletions = this.completions.literals;

        //         // console.debug(`Enclosing Type: ${completionContext.enclosingNodeType}`);
        //         let enclosingType = this.typeEnvironment.getNamed(context.enclosingNodeType);
        //         if (!!enclosingType) {
        //             // enclosingType.fields && console.debug(`Fields: ${[...enclosingType.fields.keys()]}`);
        //             fieldCompletions = fieldCompletions.filter(item => enclosingType.fields.has(item.label as FieldName));
        //             nodeCompletions = nodeCompletions.filter(item => enclosingType.typeNames.has(item.label as TypeName));
        //             literalCompletions = literalCompletions.filter(item =>
        //                 enclosingType.literals.has(Literal.dequote(item.label) as Literal)
        //             );
        //         } else {
        //             console.debug(`Failed to find type info for enclosing type '${context.enclosingNodeType}'`);
        //         }

        //         completions.push(...nodeCompletions, ...fieldCompletions, ...literalCompletions);
        //         break;
        //     case 'field-name': {
        //         const fieldNames = this.typeEnvironment.getNamed(context.parentType)?.fields?.keysArray();
        //         if (!fieldNames) {
        //             completions.push(...this.completions.fieldNames);
        //         } else {
        //             const fieldCompletions = this.completions.fieldNames.filter(item =>
        //                 fieldNames.includes(item.label as FieldName)
        //             );
        //             completions.push(...fieldCompletions);
        //         }
        //         break;
        //     }
        //     case 'field-value':
        //         {
        //             let fieldValues = context.transform ? this.completions.nodesTransformed : this.completions.nodes;
        //             const field: CheckableSubnode | undefined = this.typeEnvironment
        //                 .getNamed(context.parentType)
        //                 ?.fields?.get(context.fieldName);
        //             let literalValues = this.completions.literals;
        //             if (!!field) {
        //                 // console.debug('found field info');
        //                 fieldValues = fieldValues.filter(item => field.hasTypeName(item.label));
        //                 literalValues = literalValues.filter(item => field.hasLiteral(Literal.dequote(item.label)));
        //             }
        //             completions.push(...fieldValues, ...literalValues);
        //         }
        //         break;
        //     case 'negated-field':
        //         !!context.parentType && console.debug(`parentType: ${context.parentType}`);
        //         const fieldNames: string[] | undefined = this.typeEnvironment.getNamed(context.parentType)?.fields?.keysArray();
        //         const negatedCompletions: lsp.CompletionItem[] = !fieldNames
        //             ? this.completions.fieldNames
        //             : fieldNames.map(name => {
        //                   return {
        //                       label: name,
        //                   } satisfies lsp.CompletionItem;
        //               });
        //         completions.push(...negatedCompletions);
        //         break;
        //     default:
        //         break;
        // }

        // const list = lsp.CompletionList.create(completions, isIncomplete);
        // return list;
    }

    async onExecuteCommand(
        parameters: lsp.ExecuteCommandParams,
        token?: lsp.CancellationToken,
        workDoneProgress?: lsp.WorkDoneProgressReporter
    ): Promise<any> {
        const command: string = parameters.command;
        const args: string[] = parameters.arguments || [];

        switch (command) {
            case 'vscode-tree-sitter-dev.printDocumentTree':
                const uri = args[0]!;
                const text = this.documents.get(uri)?.getText();
                if (!text) {
                    console.debug(`Failed to retrieve text for document '${uri}'`);
                } else {
                    this.tree_sitter.scheduleParse(text, tree => {
                        if (!!tree?.rootNode) {
                            console.debug(_formatTree(tree));
                            // debug(tree.rootNode.toString());
                        }
                    });
                }
                break;
            default:
                console.debug(`Unrecognized command '${command}'`);
        }
        console.debug(`ExecuteCommand requested '${command}'`);
        return;
    }

    onDidChangeWorkspaceFolders(event: lsp.WorkspaceFoldersChangeEvent): void {
        const hasAdded: boolean = !!event.added.length;
        const hasRemoved: boolean = !!event.added.length;
        if (hasAdded) {
            this.debug(`${event.added.length} workspaces added`);
            event.added.forEach(added => this.debug(`Added workspace ${added.name}`));
        }
        if (hasRemoved) {
            this.debug(`${event.removed.length} workspaces removed`);
            event.removed.forEach(removed => this.debug(`Removed workspace ${removed.name}`));
        }
        if (!(hasAdded || hasRemoved)) {
            this.debug('No workspaces added or removed ...');
        }
    }

    async onDidChangeContent(change: lsp.TextDocumentChangeEvent<TextDocument>) {
        const document = change.document;
        const uri = document.uri;
        // this.debug(`Document changed: ${uri}`);
        let text: string;
        try {
            text = document.getText();
        } catch (error) {
            console.log("Couldn't read text");
            console.error(error);
            return;
        }
        // if (this.scheduledParser.ready) {
        this.tree_sitter.scheduleParse(text, tree => {
            if (tree === undefined || tree === null) {
                console.error(`Failed to parse document ${uri}`);
                return;
            } else {
                // console.debug(`Successfully parsed document ${uri}:`);
                // console.debug(tree);
                // console.debug(Object.getPrototypeOf(tree));
                // console.debug(tree.rootNode);
                // console.debug(tree.rootNode.toString());
                this.treeCache.set(uri, tree);
                this.captureMapCache.set(uri, Capture.Map.fromNode(tree.rootNode));
                // debug(`Cached document '${uri}'`);
                this.runDiagnostics(uri);
            }
        });
        // return this.scheduledParser.run();
        // }
    }

    onDidChangeTextDocument(params: lsp.DidChangeTextDocumentParams) {
        console.log(params.textDocument);
        params.contentChanges.map(value => {
            console.log(value.text);
        });
    }

    async onDocumentSymbol(
        params: lsp.DocumentSymbolParams,
        cancellationToken: lsp.CancellationToken
    ): Promise<lsp.DocumentSymbol[] | undefined> {
        let uri: string = params.textDocument.uri;
        let node = this.treeCache.get(uri)?.rootNode;
        if (!node || this.typeEnvironment.isEmpty) {
            return [];
        }
        let symbols: lsp.DocumentSymbol[] = [];
        let capture_names: lsp.DocumentSymbol[] = this.tree_sitter.queries.CAPTURE_NAMES.matches(node)
            .map(match => match.captures.map(c => c.node))
            .filter(([_, identifier]) => !!_ && !!identifier?.text.length)
            .map(([capture, identifier]) => {
                return {
                    name: '@' + identifier!.text,
                    kind: lsp.SymbolKind.Event,
                    range: LSPRange.fromNode(capture!),
                    selectionRange: LSPRange.fromNode(identifier!),
                } satisfies lsp.DocumentSymbol;
            });
        symbols.push(...capture_names);
        if (!cancellationToken.isCancellationRequested) {
            return symbols;
        }
    }

    async onHover(parameters: lsp.TextDocumentPositionParams, token?: lsp.CancellationToken): Promise<lsp.Hover | undefined> {
        let hover: lsp.Hover | undefined = undefined;
        try {
            let tree = this.treeCache.get(parameters.textDocument.uri);
            if (tree === undefined || tree === null) {
                return;
            }
            ('\n\n');
            let nodes = this.tree_sitter.nodes_at_position(tree, parameters.position);
            let contents = hoverDocs(this.typeEnvironment, nodes);
            if (!!contents) {
                hover = { contents };
            }
        } catch (error) {
            hover = {
                contents: 'HOVER FAILED',
            };
            console.error(error);
        }
        if (!token || !token.isCancellationRequested) {
            return hover;
        }
    }

    async onSemanticTokensFull(params: lsp.SemanticTokensParams, token?: lsp.CancellationToken): Promise<lsp.SemanticTokens> {
        let tokens: lsp.SemanticTokens = { data: [] };
        const tree = this.treeCache.get(params.textDocument.uri);
        if (!tree) {
            return tokens;
        }
        let captures = this.tree_sitter.queries.HIGHLIGHTING.matches(tree.rootNode)
            .flatMap(match => match.captures)
            .sort(Captures.sort);
        let absolutes: Token.Data.Absolute[] = captures
            .filter(capture => Token.MAP.has(capture.name))
            .map(capture => {
                let [type, modifier] = Token.MAP.get(capture.name)!;
                return Token.Data.Absolute.fromNode(capture.node, type, modifier);
            });

        if (!token || !token.isCancellationRequested) {
            tokens.data = Token.Data.Absolute.encode(absolutes);
        }
        return tokens;
    }
    //#endregion Handlers

    //#region Initialization
    async initializeParser() {
        this.tree_sitter = new TreeSitter();
        console.debug('Initializing Parser');
        const wasmPath: string = path.join(this.resourcesPath, 'tree-sitter-query.wasm');
        console.debug(`Loading Lanugage from '${wasmPath}'`);
        wts.Parser.init().then(_ => {
            readFile(wasmPath, (error, data) => {
                if (!!error) {
                    console.error(error);
                }
                wts.Language.load(data)
                    .then(language => {
                        this.tree_sitter.prime(language, this.resourcesPath);
                    })
                    .catch(reason => {
                        console.error(reason);
                    });
            });
        });
    }

    loadNodeTypes(): void {
        if (!this.workspace) {
            this.debug('No workspace to load node-types with');
            return;
        }
        let workspacePath: string | undefined = this.workspace.uri;
        if (workspacePath.startsWith('file://')) {
            workspacePath = workspacePath.split('://', 2)[1];
        }
        if (workspacePath === undefined) {
            return;
        }
        let nodeTypesPath = path.join(workspacePath, 'src', 'node-types.json');
        // this.debug(`Reading "node-types.json" from "${nodeTypesPath}"`);
        readFile(nodeTypesPath, 'utf-8', (error_, data) => {
            if (error_) {
                // console.error(`Failed to load file @ "${nodeTypesPath}"`);
                return;
            }
            // this.debug(`Succesffully read "node-types.json" @ "${nodeTypesPath}"`);

            this.nodeTypes = NodeTypes.fromString(data);
            let typeEnvironment = TypeEnvironment.fromNodeTypes(this.nodeTypes);
            this.typeEnvironment = typeEnvironment;

            this.completions.nodes = this.typeEnvironment.types
                .valuesArray()
                .filter(type => NodeType.isNotHidden(type as NodeType))
                .filter(node => !NodeType.isSupertype(node))
                .map(node => {
                    return {
                        label: node.type,
                        kind: lsp.CompletionItemKind.Class,
                        documentation: node.documentation,
                    } satisfies lsp.CompletionItem;
                });
            this.completions.nodesTransformed = this.completions.nodes.map(item => {
                return { ...item, insertText: `(${item.label})` };
            });
            this.completionEngine.cache.nodes = this.completions.nodes;
            this.completionEngine.cache.nodesTransformed = this.completions.nodesTransformed;

            let fieldNameCompletions = [...typeEnvironment.fieldNames.values()].map(name => {
                return {
                    label: name,
                    kind: lsp.CompletionItemKind.Property,
                };
            });
            this.completions.fieldNames = fieldNameCompletions;
            this.completions.fieldNamesTransformed = fieldNameCompletions.map(item => {
                let composite = typeEnvironment.getField(item.label);
                let signature: string = '[ _ (_) ]';
                if (!!composite && composite.hasLiterals && !composite.hasNamed) {
                    signature = '_';
                } else if (!!composite && !composite.hasLiterals && composite.hasNamed) {
                    signature = '(_)';
                }
                return { ...item, insertText: `${item.label}: ${signature}` };
            });
            this.completionEngine.cache.fieldNames = this.completions.fieldNames;
            this.completionEngine.cache.fieldNamesTransformed = this.completions.fieldNamesTransformed;

            this.completions.literals = [...typeEnvironment.literals].map(literal => {
                return {
                    label: `"${literal}"`,
                    kind: lsp.CompletionItemKind.Constant,
                };
            });
            this.completionEngine.cache.literals = this.completions.literals;

            for (let uri of this.documents.keys()) {
                this.runDiagnostics(uri);
            }
        });
    }
    //#endregion Initialization

    //#region Diagnostics
    clearDiagnostics(uri: string) {
        // reschedule, just in case sourceFile is current priority file
        // this.scheduleDiagnostics();

        this.connection.sendDiagnostics({
            uri: uri,
            diagnostics: [],
        });
    }

    runDiagnostics(uri: string) {
        let node = this.treeCache.get(uri)?.rootNode;
        if (!node || !this.tree_sitter.isReady || this.typeEnvironment.isEmpty) {
            return;
        }
        let diagnostics: lsp.Diagnostic[] = [];

        diagnostics.push(...lintAll(node, this.tree_sitter, this.typeEnvironment));
        this.connection.sendDiagnostics({ uri, diagnostics });
    }
    //#endregion Diagnostics
}

function hoverDocs(environment: TypeEnvironment, nodes: TSNode[]) {
    let node: TSNode | undefined = nodes[0];
    if (!node) {
        return;
    }

    let contents: string | lsp.MarkupContent | undefined;

    let chain: string = nodes.map(node => node.type).join(' <- ');
    chain += node.type === 'program' ? '\n\n' : `\n\n"${node.text}"`;
    contents = chain;

    if (!isType(node, 'identifier', '_')) {
        return contents;
    }
    const outer = closestAncestorOfType(node, 'named_node', 'field_definition', 'negated_field', 'program');

    if (!outer) {
        return contents;
    }
    const isWildcard = isType(node, '_');
    let documentation: lsp.MarkupContent | undefined;
    switch (outer.type) {
        case 'named_node': {
            if (!isWildcard) {
                documentation = environment.getNamed(node.text as TypeName)?.documentation;
                break;
            }
            const identifier = Identifier.ofNode(outer);
            if (!identifier) {
                break;
            }
            if (identifier.id === node.id) {
                // node is `(_)`
                let parent = closestAncestorOfType(outer, 'named_node', 'program', 'field_definition');
                let parentName = TypeName.fromNode(parent);
                if (parent?.type === 'program' || parentName === '_') {
                    // node is `(_)` in either `(program)` or `(_)`
                    documentation = environment.namedSignature();
                } else if (parent?.type === 'named_node') {
                    documentation = environment.getNamed(parentName)?.namedSignature();
                } else {
                    let fieldName = FieldName.fromNode(parent);
                    if (!fieldName) {
                        console.debug('No fieldName :c');
                        break;
                    }
                    console.debug(`fieldName: ${fieldName}`);
                    let parentTypeName = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, parent);
                    console.debug(`parentTypeName: ${parentTypeName}`);
                    // let parentTypeNameNode = node.parent!.parent.childForFieldName('name');
                    let fieldInfo =
                        !parentTypeName || parentTypeName === '_'
                            ? environment.getField(fieldName)
                            : environment.getNamed(parentTypeName)?.getField(fieldName);
                    if (!!fieldInfo) {
                        documentation = fieldInfo?.namedSignature();
                    }
                    // node is `(_)` inside some unknown named_node
                }
            } else {
                // node is `_` inside some unknown named_node
                documentation = environment.getNamed(TypeName.fromNode(outer))?.literalSignature();
            }

            break;
        }
        case 'field_definition':
        case 'negated_field':
            let fieldName = FieldName.fromNode(outer);
            if (!fieldName) {
                console.debug('No fieldName :c');
                break;
            }
            console.debug(`fieldName: ${fieldName}`);
            let parentTypeName = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, outer);
            console.debug(`parentTypeName: ${parentTypeName}`);
            // let parentTypeNameNode = node.parent!.parent.childForFieldName('name');
            let fieldInfo =
                !parentTypeName || parentTypeName === '_'
                    ? environment.getField(fieldName)
                    : environment.getNamed(parentTypeName)?.getField(fieldName);
            if (!!fieldInfo) {
                documentation = fieldInfo?.fieldSignature(fieldName);
            }

            break;
        case 'program':
            {
                if (isWildcard) {
                    documentation = environment.literalSignature();
                }
            }
            break;

        default:
            console.warn(`Forgot to match a case of parent.type: '${outer.type}'`);
    }
    if (!!documentation) {
        contents = documentation;
    }
    if (lsp.MarkupContent.is(contents)) {
        contents.value += '\n' + chain;
    }
    return contents;
}

function completionHandler(
    context: TSQCompletionContext,
    environment: TypeEnvironment,
    cache: LSPServer['completions'],
    captureMapCache?: Capture.Map
) {
    let completions: lsp.CompletionItem[] = [];
    switch (context.type) {
        case 'none':
            return null;
        case 'unhandled':
            completions.push(...cache.nodes, ...cache.builtins, ...cache.fieldNames, ...cache.literals);
            break;
        case 'empty_string':
            {
                let literalCompletions = cache.literals.map(item => {
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
                completions.push(...literalCompletions);
            }

            break;
        case 'capture':
            // const map: CaptureMap | undefined = this.captureMapCache.get(document.uri);
            if (!captureMapCache) {
                return null;
            }

            let completionNames: string[] = captureMapCache.keysArray();
            if (Captures.isOnlyInstanceOfName(captureMapCache, context.identifier)) {
                completionNames = completionNames.filter(name => name !== context.identifier);
            }
            const captureCompletions: lsp.CompletionItem[] = completionNames.map(name => {
                return { label: name };
            });
            completions.push(...captureCompletions);
            break;
        case 'node':
            context.transform ? completions.push(...cache.nodesTransformed) : completions.push(...cache.nodes);
            if (context.transform) {
                completions.push(...cache.literals);
            }
            break;
        case 'child':
            let [nodeCompletions, fieldCompletions] = context.transform
                ? [cache.nodesTransformed, cache.fieldNamesTransformed]
                : [cache.nodes, cache.fieldNames];
            let literalCompletions = cache.literals;

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

            completions.push(...nodeCompletions, ...fieldCompletions, ...literalCompletions);
            break;
        case 'field_name': {
            const fieldNames = environment.getNamed(context.parentType)?.fields?.keysArray();
            if (!fieldNames) {
                completions.push(...cache.fieldNames);
            } else {
                const fieldCompletions = cache.fieldNames.filter(item => fieldNames.includes(item.label as FieldName));
                completions.push(...fieldCompletions);
            }
            break;
        }
        case 'field_value':
            {
                let fieldValues = context.transform ? cache.nodesTransformed : cache.nodes;
                const field: CheckableSubnode | undefined = environment
                    .getNamed(context.parentType)
                    ?.fields?.get(context.fieldName);
                let literalValues = cache.literals;
                if (!!field) {
                    // console.debug('found field info');
                    fieldValues = fieldValues.filter(item => field.hasTypeName(item.label));
                    literalValues = literalValues.filter(item => field.hasLiteral(Literal.dequote(item.label)));
                }
                completions.push(...fieldValues, ...literalValues);
            }
            break;
        case 'negated_field':
            !!context.parentType && console.debug(`parentType: ${context.parentType}`);
            const fieldNames: string[] | undefined = environment.getNamed(context.parentType)?.fields?.keysArray();
            const negatedCompletions: lsp.CompletionItem[] = !fieldNames
                ? cache.fieldNames
                : fieldNames.map(name => {
                      return {
                          label: name,
                      } satisfies lsp.CompletionItem;
                  });
            completions.push(...negatedCompletions);
            break;
        default:
            break;
    }
    return lsp.CompletionList.create(completions, false);
    return null;
}
