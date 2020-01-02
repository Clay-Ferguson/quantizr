export interface LocalDBIntf {
    writeObject(val: Object): any;
    readObject(name: string): Promise<Object>;
   
    getVal(key: string): Promise<any>;
    setVal(key: string, val: any): Promise<void>;
}
