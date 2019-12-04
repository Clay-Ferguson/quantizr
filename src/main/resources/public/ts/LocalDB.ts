import { LocalDBIntf } from "./intf/LocalDBIntf";

console.log("LocalDB.ts");

/* Wraps a transaction of the CRUD operations for access to JavaScript local storage IndexedDB API */
export class LocalDB implements LocalDBIntf {

    /* DB and Store names */
    static STORE_NAME = "SubNodeObjStore";
    static DB_NAME = "SubNodeDB";

    /* WARNING: boosting the version will WIPE OUT the old database, and create a brand new one */
    static VERSION = 1;

    static ACCESS_READWRITE: IDBTransactionMode = "readwrite";
    static ACCESS_READONLY: IDBTransactionMode = "readonly";
    static KEY_NAME = "name";

    openDB = (): IDBOpenDBRequest => {
        if (!indexedDB) {
            throw "IndexedDB API not available in browser.";
        }
        let req = indexedDB.open(LocalDB.DB_NAME, LocalDB.VERSION);

        req.onupgradeneeded = () => {
            req.result.createObjectStore(LocalDB.STORE_NAME, { keyPath: LocalDB.KEY_NAME });
        };
        return req;
    }

    /* Runs a transaction by first opening the database, and then running the transaction */
    runTrans = (access: IDBTransactionMode, runner: (store: any) => void) => {
        let req = this.openDB();
        req.onsuccess = () => {
            let db = req.result;
            this.runTransWithDb(db, access, runner);
        }
    }

    /* Runs a transaction on the database provided */
    runTransWithDb = (db: IDBDatabase, access: IDBTransactionMode, runner: (store: any) => void) => {
        let tx = db.transaction(LocalDB.STORE_NAME, access);
        let store = tx.objectStore(LocalDB.STORE_NAME);

        runner(store);

        tx.oncomplete = () => {
            //todo-1: need to research best practice for this, and see if we should be closing the DB here or if there's
            //some better pattern for keeping it open for more transactions.
            db.close();
        };
    }

    /* Saves an object under the specified name. Basically emulating a simple "map" with string key. */
    writeObject = (val: Object): void => {
        this.runTrans(LocalDB.ACCESS_READWRITE,
            (store: any) => {
                store.put(val);
            });
    }

    // readObject_oldNonPromise = (name: string, dataSuccessCallback: (val: Object) => void): any => {
    //     this.runTrans(LocalDB.ACCESS_READONLY,
    //         (store: any) => {
    //             //NOTE: name is the "keyPath" value.
    //             let promise = store.get(name);
    //             promise.onsuccess = () => {
    //                 dataSuccessCallback(promise.result);
    //             };
    //         });
    // }

    readObject = async (name: string): Promise<Object> => {
        return new Promise<Object>(async (resolve, reject) => {
            this.runTrans(LocalDB.ACCESS_READONLY,
                (store: any) => {
                    //NOTE: name is the "keyPath" value.
                    let promise = store.get(name);

                    promise.onsuccess = () => {
                        resolve(promise.result);
                    };
                });
        });
    }
}
