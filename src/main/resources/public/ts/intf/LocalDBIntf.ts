export interface LocalDBIntf {
    writeObject(val: Object): any;

    /* todo-1: add a memoize flag, so that we can hold in a cache (JS memory) once read, and never go to actual local store again.
    during the current JS app instance. */
    readObject(name: string): Promise<Object>;

    getVal(key: string): Promise<any>;
    setVal(key: string, val: any): Promise<void>;
}
