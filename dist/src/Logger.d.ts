declare type optionName = 'withColor' | 'alertFrequency';
export declare class Logger {
    static setOption(key: optionName | string, data: any): void;
    private name;
    private color;
    private withColor;
    private alerts;
    constructor(name: string | {
        toString: () => string;
    }, color?: string);
    debugger(...args: Array<any>): void;
    todo(...args: Array<any>): void;
    debug(...args: Array<any>): void;
    stats(...args: Array<any>): void;
    log(...args: Array<any>): void;
    warn(...args: Array<any>): void;
    alert(...args: Array<any>): void;
    error(...args: Array<any>): void;
    _write(std: number, header: string, message: string): boolean;
    _alert(message: string): void;
    _headers(tagName: string, ...modifiers: Array<string>): string;
    _tag(name: string, modifiers: Array<string>): string;
    _date(): string;
    _datePad(number: number): string;
    _format(args: any): any;
    _sprintf(pattern: string, args: Array<any>): string;
}
export {};
