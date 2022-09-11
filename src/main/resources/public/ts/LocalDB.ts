import * as J from "./JavaIntf";
import { S } from "./Singletons";

/* Wraps a transaction of the CRUD operations for access to JavaScript local storage IndexedDB API

todo-0: I can probably change this back to where it holds the databse open forever.
*/
export class LocalDB {
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

    private openDB = (): Promise<IDBDatabase> => {
        if (!indexedDB) {
            throw new Error("IndexedDB API not available in browser.");
        }

        return new Promise<IDBDatabase>((resolve, reject) => {
            const req: IDBOpenDBRequest = indexedDB.open(LocalDB.DB_NAME, LocalDB.VERSION);

            req.onupgradeneeded = () => {
                req.result.createObjectStore(LocalDB.STORE_NAME, { keyPath: LocalDB.KEY_NAME });
            };

            req.onsuccess = () => {
                // this is a one level recursion, just as a design choice. This isn't inherently a recursive operation.
                if (req.result) {
                    resolve(req.result);
                }
            };

            req.onerror = () => {
                console.warn("indexedDB.open failed");
                reject(null);
            }
        });
    }

    /* Runs a transaction by first opening the database, and then running the transaction */
    private runTrans = async (access: IDBTransactionMode, runner: (store: IDBObjectStore) => void) => {
        const db: IDBDatabase = await this.openDB();
        const tx: IDBTransaction = db.transaction(LocalDB.STORE_NAME, access);
        const store: IDBObjectStore = tx.objectStore(LocalDB.STORE_NAME);

        if (store) {
            runner(store);
        }
        else {
            console.error("Failed to open indexDb store");
        }

        tx.oncomplete = () => {
            // todo-2: need to research best practice for this, and see if we should be closing the DB here or if there's
            // some better pattern for keeping it open for more transactions.
            db.close();
        };

        tx.onabort = () => {
            console.log("tx fail");
            db.close();
        }

        tx.onerror = () => {
            console.log("tx err");
            db.close();
        }
    }

    // gets the value stored under the key (like a simple map/keystore)
    public getVal = async (key: string, userName: string = null): Promise<any> => {
        const obj: any = await this.readObject(this.getKeyPrefix(userName) + key);
        // console.log("LocalDB[" + LocalDB.DB_NAME + "] getVal name=" + key + " val=" + obj?.val);
        return obj ? obj.val : null;
    }

    // stores the value under this key  (like a simple map/keystore)
    public setVal = async (key: string, val: any, userName: string = null) => {
        // console.log("LocalDB[" + LocalDB.DB_NAME + "] setVal name=" + key + " val=" + val);
        await this.writeObject({ name: this.getKeyPrefix(userName) + key, val });
    }

    public writeObject = async (val: Object): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            this.runTrans(LocalDB.ACCESS_READWRITE,
                (store: IDBObjectStore) => {
                    // console.log("LocalDB[" + LocalDB.DB_NAME + "] writeObject=" + S.util.prettyPrint(val));
                    const req = store.put(val);
                    req.onsuccess = () => {
                        resolve();
                    };
                    req.onerror = () => {
                        resolve();
                    };
                });
        });
    }

    /* Looks up the object and returns that object which will have the 'name' as a propety in it
    just like it did when stored under that 'name' as the key */
    public readObject = async (name: string): Promise<Object> => {
        return new Promise<Object>((resolve, reject) => {
            this.runTrans(LocalDB.ACCESS_READONLY,
                (store: IDBObjectStore) => {
                    // NOTE: name is the "keyPath" value.
                    const req = store.get(name);
                    req.onsuccess = () => {
                        resolve(req.result);
                    };
                    req.onerror = () => {
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
