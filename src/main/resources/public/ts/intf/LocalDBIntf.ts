export interface LocalDBIntf {

    // we get userName from here rather than appState.userName, just for a bit less tight coupling.
    userName: string;

    writeObject(val: Object): any;
    readObject(name: string): Promise<Object>;

    getVal(key: string, userName?: string): Promise<any>;
    setVal(key: string, val: any, userName?: string): Promise<void>;
}
