import { readFileSync } from 'fs';
import * as path from 'path';
import * as lsp from 'vscode-languageserver';
import { Language, Parser, Query, QueryCapture, QueryMatch, QueryOptions, Tree } from 'web-tree-sitter';
import { Dict } from './Dict';
import { isNotNullish } from './predicates';
import { QueryLike, UninitializedQuery } from './queries/DummyQuery';
import { Queries, queries } from './queries/queries';
import { TSNode } from './reexports';

export type ParseCallback = (result?: Tree | null) => unknown;
export type ParseTask = [lsp.DocumentUri, ParseCallback];

const VOID_CALLBACK = (_: any): void => {};

export class TreeSitter {
    isReady: boolean = false;
    isRunning: boolean = false;
    queue: ParseTask[] = [];
    parser?: Parser = undefined;
    queries: Queries = queries;

    prime(language: Language, resourcesPath: string) {
        let parser = new Parser();
        // console.debug('parser created');
        parser.setLanguage(language);
        // console.debug('Language set');
        this.parser = parser;

        for (let entry of this._queries()) {
            let [name, query] = entry;
            if (UninitializedQuery.is(query) && query.source === '') {
                const path_ = path.join(resourcesPath, 'queries', name.toLowerCase() + '.scm');
                this.queries[name] = query.initialize(language, path_);
            } else {
                this.queries[name] = query.initialize(language);
            }
        }

        this.isReady = true;
        if (!!this.queue.length && !this.isRunning) {
            this.run();
        }
    }

    loadQuery(name: keyof Queries, pathToScm: string) {
        try {
            const contents = readFileSync(pathToScm, { encoding: 'utf-8' });
            const query = new Query(this.parser!.language!, contents);
            this.queries[name] = query;
            console.debug(`Successfully loaded contents for query '${name}'`);
        } catch (e) {
            console.error(`Failed to load contents for query '${name}' @ '${pathToScm}'`);
            console.error(e);
        }
    }

    async scheduleParse(source: string, callback: ParseCallback = VOID_CALLBACK) {
        this.queue.push([source, callback]);
        // console.debug(`${this.queue.length} ParseTasks queued`);
        if (!this.isReady) {
            console.warn("ScheduledParser parser hasn't been initialized yet");
        }
        return this.run();
    }

    async run() {
        if (!this.isReady) {
            setTimeout(() => this.run(), 1);
            return;
        }
        if (this.isRunning) {
            console.warn('ScheduledParser already running - cancelling start');
            return;
        }
        // console.debug('Starting scheduled parser');
        this.isRunning = true;
        while (this.isRunning) {
            if (this.queue.length) {
                // console.debug(`Performing ParseTask`);
                let task = this.queue.shift();
                if (task === undefined) {
                    break;
                }
                this.executeParseTask(...task);
                // console.debug(`${this.queue.length} ParseTasks left in queue`);
            }
            if (this.queue.length === 0) {
                this.stop();
            }
        }
    }

    executeParseTask(source: string, callback: ParseCallback) {
        try {
            this.parser?.reset();
            let tree = this.parser?.parse(source);
            switch (tree) {
                case undefined:
                    return console.error('tree was undefined');
                case null:
                    return console.error('tree was null');
                default:
                    callback(tree);
            }
        } catch (error) {
            console.error('Failed to execute scheduled parse');
            console.error(error);
        }
    }

    async stop() {
        this.isRunning = false;
        // console.debug('Stopping scheduled parser');
    }

    private _queries(): [keyof typeof queries, UninitializedQuery][] {
        return Object.entries(this.queries).filter(isUninitalizedQueryEntry);
    }
    node_at_position(tree: Tree, position: lsp.Position): TSNode | undefined {
        if (!this.isReady) {
            return;
        }

        try {
            let options: QueryOptions = {
                startPosition: { row: position.line, column: position.character },
                endPosition: { row: position.line, column: position.character },
            };
            if (position.line === 0 && position.character === 0) {
                options.endPosition!.column = 1;
            } else {
                options.startPosition!.column = Math.max(0, position.character - 1);
            }
            const node: TSNode | undefined = this.queries.ANY_NODE.matches(tree.rootNode, options) //
                .filter(match => !!match.captures.length)
                .map(match => match.captures[0]!)
                .map(c => c.node)
                .pop();
            return node;
        } catch (error) {
            console.error(error);
        }
        return;
    }

    /**
     * Returns a list of Nodes in ascending order (most-specific to least-specific)
     */
    nodes_at_position(tree: Tree, position: lsp.Position) {
        if (!tree.rootNode) {
            console.debug('rootNode is undefined');
            return [];
        }
        if (!this.isReady) {
            return [];
        }
        try {
            let options: QueryOptions = {
                startPosition: { row: position.line, column: position.character },
                endPosition: { row: position.line, column: position.character + 1 },
            };
            if (position.line === 0 && position.character === 0) {
                options.endPosition!.column = 1;
            } else {
                // options.startPosition!.column = Math.max(0, position.character - 1);
            }
            let nodes = this.queries.ANY_NODE.matches(tree.rootNode, options)
                .map(match => match.captures[0])
                .filter(isNotNullish)
                .map(c => c.node);
            nodes.reverse();
            return nodes;
        } catch (error) {
            console.error(error);
        }
        return [];
    }
}

export function sortTSNodes(a: TSNode, b: TSNode): number {
    if (a.startIndex === b.startIndex) {
        return a.endIndex - b.endIndex;
    }
    return a.startIndex - b.startIndex;
}

function isUninitalizedQueryEntry(entry: [string, QueryLike]): entry is [keyof typeof queries, UninitializedQuery] {
    return entry[1] instanceof UninitializedQuery;
}
export type CaptureName = string;

export namespace Capture {
    type CaptureMap = Dict<CaptureName, TSNode[]>;
    export type Map = CaptureMap;

    export function name(capture: QueryCapture): string {
        return capture.name;
    }

    export function withName(match: QueryMatch, name: string): QueryCapture | undefined;
    export function withName(captures: QueryCapture[], name: string): QueryCapture | undefined;
    export function withName(arg: QueryMatch | QueryCapture[], name: string): QueryCapture | undefined;
    export function withName(arg: QueryMatch | QueryCapture[], name: string): QueryCapture | undefined {
        return Captures.withName(arg, name).at(0);
    }

    export function hasName(name: string): (capture: QueryCapture) => boolean {
        return (capture: QueryCapture): boolean => capture.name === name;
    }

    export function node(capture: QueryCapture): TSNode {
        return capture.node;
    }

    export namespace Map {
        export function fromNode(node: TSNode): Capture.Map {
            let map: Capture.Map = new Dict();
            queries.CAPTURE_NAMES.matches(node)
                .flatMap(match => match.captures)
                .filter(capture => capture.name === 'capture-name')
                .map(capture => capture.node)
                .forEach(node => {
                    const name: CaptureName = node.text;
                    map.get(name)?.push(node) || map.set(name, [node]);
                });
            return map;
        }
    }
}

// namespace CaptureMap {
//     export function fromNode(node: TSNode): Capture.Map {
//         let map: Capture.Map = new Dict();
//         queries.CAPTURE_NAMES.matches(node)
//             .flatMap(match => match.captures)
//             .filter(capture => capture.name === 'capture-name')
//             .map(capture => capture.node)
//             .forEach(node => {
//                 const name: CaptureName = node.text;
//                 map.get(name)?.push(node) || map.set(name, [node]);
//             });
//         return map;
//     }
// }

// export function CaptureMapFromNode(node: TSNode): CaptureMap {
//     let map: CaptureMap = new Dict();
//     queries.CAPTURE_NAMES.matches(node)
//         .flatMap(match => match.captures)
//         .filter(capture => capture.name === 'capture-name')
//         .map(capture => capture.node)
//         .forEach(node => {
//             const name: CaptureName = node.text;
//             map.get(name)?.push(node) || map.set(name, [node]);
//         });
//     return map;
// }
export namespace Captures {
    export function sort(a: QueryCapture, b: QueryCapture) {
        return a.node.startIndex === b.node.startIndex
            ? a.node.endIndex - b.node.endIndex
            : a.node.startIndex - b.node.startIndex;
    }

    export function withName(captures: QueryCapture[], name: string): QueryCapture[];
    export function withName(match: QueryMatch, name: string): QueryCapture[];
    export function withName(arg: QueryMatch | QueryCapture[], name: string): QueryCapture[];
    export function withName(arg: QueryMatch | QueryCapture[], name: string): QueryCapture[] {
        const captures = Array.isArray(arg) ? arg : arg.captures;
        return captures.filter(capture => capture.name === name);
    }

    export function isOnlyInstanceOfName(map?: Capture.Map, name?: string) {
        return !!name && map?.get(name)?.length === 1;
    }
}
