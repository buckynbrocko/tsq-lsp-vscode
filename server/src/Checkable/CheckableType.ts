export interface CheckableType {
    type: string;
    named: true;
    extra?: true;
    root?: true;
    readonly classification: string;
}
