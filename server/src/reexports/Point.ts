import * as wts from 'web-tree-sitter';

export type WTSPoint = wts.Point;

export function WTSPoint(row: number = 0, column: number = 0): wts.Point {
    return { row, column };
}

export namespace WTSPoint {
    export function present(point: WTSPoint): string {
        return `(ln${point.row}, ch${point.column})`;
    }

    export function is(object: any): object is WTSPoint {
        return typeof object['row'] === 'number' && typeof object['column'] === 'number';
    }
}
