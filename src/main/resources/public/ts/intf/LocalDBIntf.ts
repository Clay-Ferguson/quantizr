export interface LocalDBIntf {

    // we get userName from here rather than appState.userName, just for a bit less tight coupling.
    userName: string;

    writeObject(val: Object): any;

    /* todo-1: add a memoize flag, so that we can hold in a cache (JS memory) once read, and never go to actual local store again.
    during the current JS app instance. */
    readObject(name: string): Promise<Object>;

    getVal(key: string, userName?: string): Promise<any>;
    setVal(key: string, val: any, userName?: string): Promise<void>;
}
