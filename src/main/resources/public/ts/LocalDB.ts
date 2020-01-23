import { LocalDBIntf } from "./intf/LocalDBIntf";

/* Wraps a transaction of the CRUD operations for access to JavaScript local storage IndexedDB API */
export class LocalDB implements LocalDBIntf {

    /* DB and Store names */
    static STORE_NAME = "objstore";
    static DB_NAME = "DB-" + window.location.hostname + "-" + window.location.port;

    /* WARNING: boosting the version will WIPE OUT the old database, and create a brand new one */
    static VERSION = 1;

    static ACCESS_READWRITE: IDBTransactionMode = "readwrite";
    static ACCESS_READONLY: IDBTransactionMode = "readonly";
    static KEY_NAME = "name";
    static KEY_VAL_NAME_PREFIX = "kv_";

    openDB = (): IDBOpenDBRequest => {
        if (!indexedDB) {
            throw "IndexedDB API not available in browser.";
        }
        let req: IDBOpenDBRequest = indexedDB.open(LocalDB.DB_NAME, LocalDB.VERSION);

        req.onupgradeneeded = () => {
            req.result.createObjectStore(LocalDB.STORE_NAME, { keyPath: LocalDB.KEY_NAME });
        };
        return req;
    }

    /* Runs a transaction by first opening the database, and then running the transaction */
    runTrans = (access: IDBTransactionMode, runner: (store: IDBObjectStore) => void) => {
        let req: IDBOpenDBRequest = this.openDB();
        req.onsuccess = () => {
            let db: IDBDatabase = req.result;
            this.runTransWithDb(db, access, runner);
        }
    }

    /* Runs a transaction on the database provided */
    runTransWithDb = (db: IDBDatabase, access: IDBTransactionMode, runner: (store: IDBObjectStore) => void) => {
        let tx: IDBTransaction = db.transaction(LocalDB.STORE_NAME, access);
        let store: IDBObjectStore = tx.objectStore(LocalDB.STORE_NAME);

        runner(store);

        tx.oncomplete = () => {
            //todo-1: need to research best practice for this, and see if we should be closing the DB here or if there's
            //some better pattern for keeping it open for more transactions.
            db.close();
        };
    }

    // gets the value stored under the key (like a simple map/keystore)
    getVal = (key: string): Promise<any> => {
        return new Promise<any>(async (resolve, reject) => {
            let obj: any = await this.readObject(LocalDB.KEY_VAL_NAME_PREFIX + key);
            resolve(!!obj ? obj.val : null);
        });
    }

    // stores the value under this key  (like a simple map/keystore)
    setVal = (key: string, val: any): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            await this.writeObject({ name: LocalDB.KEY_VAL_NAME_PREFIX + key, val });
            resolve();
        });
    }

    /* Saves an object under the specified name, assuming the object itself has a 'name' property.
     Basically emulating a simple "map" with string key. */
    writeObject = (val: Object): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            this.runTrans(LocalDB.ACCESS_READWRITE,
                (store: IDBObjectStore) => {
                    store.put(val);
                    resolve();
                });
        });
    }

    /* Looks up the object and returns that object which will have the 'name' as a propety in it
    just like it did when stored under that 'name' as the key */
    readObject = async (name: string): Promise<Object> => {
        return new Promise<Object>(async (resolve, reject) => {
            this.runTrans(LocalDB.ACCESS_READONLY,
                (store: IDBObjectStore) => {
                    //NOTE: name is the "keyPath" value.
                    let promise = store.get(name);

                    promise.onsuccess = () => {
                        resolve(promise.result);
                    };
                });
        });
    }
}
