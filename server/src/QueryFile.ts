import * as WTS from 'web-tree-sitter';
import { Definition } from './Definition';
import { Dict } from './Dict';
import { Grammar } from './Grammar';
import { TSNode } from './reexports';

export class QueryFile {
    private _topLevelNodes: Definition[] = [];
    constructor(public grammar: Grammar, private _nodes: Dict<number, Definition> = new Dict()) {}

    get IDs(): Set<number> {
        return new Set(this._nodes.keys());
    }

    get topLevelNodes(): Definition[] {
        return [...this._topLevelNodes];
    }

    *yieldNodes() {
        for (let node of this._nodes.values()) {
            yield node;
        }
        return;
    }

    nodesOfType<T extends Definition['nodeType']>(...nodeTypes: T[]): Extract<Definition, { nodeType: T }>[] {
        return this._nodes.valuesArray().filter(node => Definition.isType(node, ...nodeTypes));
    }

    has(arg: number | Definition): boolean {
        let id = typeof arg === 'number' ? arg : arg.id;
        return this._nodes.has(id);
    }

    public getNodeByID(id: number): Definition | undefined {
        return this._nodes.get(id);
    }

    private addNode(node: Definition) {
        if (this.has(node)) {
            console.warn(`${Object.getPrototypeOf(this).name} already has node id ${node.id}`);
        }
        this._nodes.set(node.id, node);
    }

    getOrTryNew(node: TSNode) {
        return this._nodes.get(node.id) ?? this.tryNewNode(node);
    }

    tryNewNode(node: TSNode): Definition | undefined {
        let newNode = Definition.tryFrom(node, this);
        if (!!newNode) {
            this.addNode(newNode);
        }
        return newNode;
    }

    static fromTree(tree: WTS.Tree, grammar: Grammar) {
        const rootNode = tree.rootNode;
        let instance = new QueryFile(grammar);
        for (let child of rootNode.children) {
            if (child !== null) {
                let node = instance.tryNewNode(child);
                if (!!node) {
                    instance._topLevelNodes.push(node);
                }
            }
        }
        return instance;
    }

    static tryFromTree(tree: WTS.Tree | undefined, grammar: Grammar): QueryFile | undefined {
        if (!tree) {
            return;
        }
        try {
            return QueryFile.fromTree(tree, grammar);
        } catch {}
        return;
    }
}
