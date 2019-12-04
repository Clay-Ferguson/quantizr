console.log("SearchIntf.ts");

export interface LocalDBIntf {
    writeObject(val: Object): any;
    readObject(name: string): Promise<Object>;
}
