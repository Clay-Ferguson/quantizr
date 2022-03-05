import * as J from "./JavaIntf";
import { S } from "./Singletons";

/* Wraps a transaction of the CRUD operations for access to JavaScript local storage IndexedDB API */
export class LocalDB {

    // For performance, I think it may be better to just never close the database once opened, but this flag allows
    // the logic to flow either way if we ever need to (close always or not)
    keepDbOpen: boolean = true;
    db: IDBDatabase = null;

    /* Name of logged in user or 'null' if anonymous user not logged in */
    userName: string;

    /* DB and Store names */
    static STORE_NAME = "objstore";
    static DB_NAME = "DB-" + window.location.hostname + "-" + window.location.port;

    /* WARNING: boosting the version will WIPE OUT the old database, and create a brand new one */
    static VERSION = 1;

    static ACCESS_READWRITE: IDBTransactionMode = "readwrite";
    static ACCESS_READONLY: IDBTransactionMode = "readonly";
    static KEY_NAME = "name";

    private openDB = (): IDBOpenDBRequest => {
        if (!indexedDB) {
            throw new Error("IndexedDB API not available in browser.");
        }
        const req: IDBOpenDBRequest = indexedDB.open(LocalDB.DB_NAME, LocalDB.VERSION);

        req.onupgradeneeded = () => {
            req.result.createObjectStore(LocalDB.STORE_NAME, { keyPath: LocalDB.KEY_NAME });
        };
        return req;
    }

    /* Runs a transaction by first opening the database, and then running the transaction */
    private runTrans = (access: IDBTransactionMode, runner: (store: IDBObjectStore) => void) => {

        if (this.db) {
            const tx: IDBTransaction = this.db.transaction(LocalDB.STORE_NAME, access);
            const store: IDBObjectStore = tx.objectStore(LocalDB.STORE_NAME);

            runner(store);

            tx.oncomplete = () => {
                if (!this.keepDbOpen) {
                    // todo-2: need to research best practice for this, and see if we should be closing the DB here or if there's
                    // some better pattern for keeping it open for more transactions.
                    this.db.close();
                    this.db = null;
                }
            };
        }
        else {
            const req: IDBOpenDBRequest = this.openDB();
            req.onsuccess = () => {
                // this is a one level recursion, just as a design choice. This isn't inherently a recursive operation.
                if (req.result) {
                    this.db = req.result;
                    this.runTrans(access, runner);
                }
            };

            req.onerror = () => {
                console.warn("runTrans failed");
            };
        }
    }

    // gets the value stored under the key (like a simple map/keystore)
    getVal = async (key: string, userName: string = null): Promise<any> => {
        let obj: any = null;
        try {
            const keyPrefix = this.getKeyPrefix(userName);
            obj = await this.readObject(keyPrefix + key);
            // console.log("LocalDB[" + LocalDB.DB_NAME + "] getVal name=" + keyPrefix + key + " val=" + (!!obj ? obj.val : null));
        }
        catch {
            // ignore this exception
        }
        return obj ? obj.val : null;
    }

    // stores the value under this key  (like a simple map/keystore)
    setVal = async (key: string, val: any, userName: string = null): Promise<void> => {
        const keyPrefix = this.getKeyPrefix(userName);
        // console.log("LocalDB[" + LocalDB.DB_NAME + "] setVal name=" + keyPrefix + key + " val=" + val);
        await this.writeObject({ name: keyPrefix + key, val });
    }

    /* Saves an object under the specified name, assuming the object itself has a 'name' property.
     Basically emulating a simple "map" with string key. */
    writeObject = async (val: Object): Promise<void> => {
        // We use a Promise here because we're sesolving inside a callback
        return new Promise<void>(async (resolve, reject) => {
            this.runTrans(LocalDB.ACCESS_READWRITE,
                (store: IDBObjectStore) => {
                    // console.log("LocalDB[" + LocalDB.DB_NAME + "] writeObject=" + S.util.prettyPrint(val));
                    store.put(val);
                    resolve();
                });
        });
    }

    /* Looks up the object and returns that object which will have the 'name' as a propety in it
    just like it did when stored under that 'name' as the key */
    readObject = async (name: string): Promise<Object> => {
        // We use Promise instead of async/await because we need to resolve inside callbacks (not our own design choice)
        return new Promise<Object>(async (resolve, reject) => {
            this.runTrans(LocalDB.ACCESS_READONLY,
                (store: IDBObjectStore) => {
                    // NOTE: name is the "keyPath" value.
                    const promise = store.get(name);

                    promise.onsuccess = () => {
                        resolve(promise.result);
                    };
                    promise.onerror = () => {
                        console.warn("readObject failed: name=" + name);
                        resolve(null);
                    };
                });
        });
    }

    private getKeyPrefix = (userName: string): string => {
        let prefix;

        // allow parameter userName to override with special case handled for 'anon'
        if (userName) {
            if (userName === J.PrincipalName.ANON) {
                userName = null;
            }
            prefix = userName ? (userName + "_") : "kv_";
        }
        // else use this.userName
        else {
            prefix = this.userName ? (this.userName + "_") : "kv_";
        }

        let ret = prefix + location.host + "_";
        ret = S.util.replaceAll(ret, ":", "_");
        return ret;
    }
}
