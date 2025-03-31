/**
 * IndexedDB Storage wrapper class
 * Provides a Promise-based API for using IndexedDB
 */
class IndexedDB {
    constructor() {
        console.log('IndexedDB singleton created');
    }

    // New static factory method to replace async constructor
    static async getInst(dbName, storeName, dbVersion) {
        // Create instance if it doesn't exist
        if (!IndexedDB.inst) {
            IndexedDB.inst = new IndexedDB();

            console.log("Waiting for DB")
            await IndexedDB.inst.initDB(dbName, storeName, dbVersion);
            console.log("DB ready")
        }

        return IndexedDB.inst;
    }

    /**
     * Initialize the IndexedDB database
     */
    async initDB(dbName, storeName, dbVersion) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.dbVersion = dbVersion;

        const dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });

        this.db = await dbPromise;
    }

    /**
     * Store a value in the database
     * @param {string} key - The key to store the value under
     * @param {any} value - The value to store
     * @returns {Promise} Promise that resolves when the operation is complete
     */
    async setItem(key, value) {
        this.checkDB();
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(value, key);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(event.target.error);
            });
        } catch (error) {
            console.error('Error in setItem:', error);
            throw error;
        }
    }

    /**
     * Retrieve a value from the database
     * @param {string} key - The key to retrieve
     * @returns {Promise<any>} Promise that resolves with the retrieved value
     */
    async getItem(key) {
        this.checkDB();
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        } catch (error) {
            console.error('Error in getItem:', error);
            throw error;
        }
    }

    /**
     * Remove a value from the database
     * @param {string} key - The key to remove
     * @returns {Promise} Promise that resolves when the operation is complete
     */
    async removeItem(key) {
        this.checkDB();
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(event.target.error);
            });
        } catch (error) {
            console.error('Error in removeItem:', error);
            throw error;
        }
    }

    /**
     * Clear all data from the store
     * @returns {Promise} Promise that resolves when the operation is complete
     */
    async clear() {
        this.checkDB();
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(event.target.error);
            });
        } catch (error) {
            console.error('Error in clear:', error);
            throw error;
        }
    }

    /**
     * Get all keys in the store
     * @returns {Promise<Array<string>>} Promise that resolves with an array of keys
     */
    async keys() {
        this.checkDB();
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAllKeys();

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        } catch (error) {
            console.error('Error in keys:', error);
            throw error;
        }
    }

    checkDB() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initDB() first, and inside getInstance() only.');
        }
    }
}

export default IndexedDB;