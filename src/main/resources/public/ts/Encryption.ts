import * as J from "./JavaIntf";
import { EncryptionKeyPair } from "./EncryptionKeyPair";
import { EncryptionIntf, SymKeyDataPackage } from "./intf/EncryptionIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/*
PUBLIC KEY ENCRYPTION
---------------------
This class is for proof-of-concept work related to doing Public Key Encryption in the browser using the
WebCryptoAPI, for a "Secure Messaging" feature of Quana. Currently the way this test/develop is run is by using
'encryption.test()'

We will be using LocalDB.ts implementation to store the keys in the browser, but we will also support
allowing the user to cut-n-paste they Key JSON, so that if something goes wrong with the
browser storage the user will not loose their keys because they will be able
to reimport the JSON key text back in at any time, or install the keys in a different browser.

At no point in time does the users' Private Key ever leave their own browser storage.


SYMMETRIC ENCRYPTION
--------------------
Code complete except for we have a hardcoded password instead of prompting user for the password. This feature
will be complete once we prompt user for password.

TIP: (Not currenty used)
Original way I had for creating a hashe-based key from a password:

    let hashPromise = this.crypto.subtle.digest({ name: "SHA-256" }, this.convertStringToByteArray(password));
    hashPromise.then((hash: any) => {
    let keyPromise = this.crypto.subtle.importKey("raw", hash, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
*/

export class Encryption implements EncryptionIntf {

    /* jwk = JSON Format */
    KEY_SAVE_FORMAT = "jwk";

    //asymetric keys (public/private)
    STORE_ASYMKEY = "asymkey";

    // symmetric key
    STORE_SYMKEY = "symkey";

    // 'Public Key' AES Encryption algo.
    ASYM_ALGO = "RSA-OAEP";

    // Symmetric Algo. We use GCM mode of AES because it detects data corruptions during decryption
    SYM_ALGO = "AES-GCM";

    HASH_ALGO = "SHA-256";

    ASYM_IMPORT_ALGO = {
        name: "RSA-OAEP",
        hash: "SHA-256",
    };

    OP_ENC_DEC = ["encrypt", "decrypt"];
    OP_ENC: string[] = ["encrypt"];
    OP_DEC: string[] = ["decrypt"];

    vector: Uint8Array = null;

    logKeys: boolean = false;

    constructor() {
        /* WARNING: Crypto (or at least subtle) will not be available except on Secure Origin, which means a SSL (https) 
        web address plus also localhost */

        if (!crypto || !crypto.subtle) {
            console.log("WebCryptoAPI not available");
            return;
        }

        /* 
        Note: This vector is merely required
        to be large enough and random enough, but is not required to be secret. 16 randomly chosen prime numbers. 
        WARNING: If you change this you will NEVER be able to recover any data encrypted with it in effect, even with the correct password. So 
        beware if you change this you've basically lost ALL your passwords. So just don't change it.

        todo-1: Some crypto experts told me this IV should not be reused like this but instead stored along with the encryption key.
        */
        //iv = window.crypto.getRandomValues(new Uint8Array(16)); <--- I saw this in a reputable example. Try it out!
        this.vector = new Uint8Array([71, 73, 79, 83, 89, 37, 41, 47, 53, 67, 97, 103, 107, 109, 127, 131]);
    }

    /* Runs a full test of all encryption code.
    
       Assumes that Encryption.initKeys() has previously been called, which is 
       safe to assume because we run it during app initialization.
    */
    test = async (): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let results = "";
            try {
                this.runConversionTest();
                await this.runPublicKeyTest();
                await this.symetricEncryptionTest();
                await this.secureMessagingTest();

                console.log("All Encryption Tests: OK");
            }
            finally {
                resolve(results);
            }
        });
    }

    secureMessagingTest = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                console.log("running secureMessagingTest...");
                let clearText = "This is cleartext";
                let skdp: SymKeyDataPackage = await this.encryptSharableString(null, clearText);
                let checkText = await this.decryptSharableString(null, skdp);
                S.util.assert(checkText === clearText, "verifying cleartext");
                console.log("secureMessagingTest: OK");
            }
            finally {
                resolve();
            }
        });
    }

    symetricEncryptionTest = async (): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            let clearText = "Encrypt this string.";

            // test symetric encryption
            let obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                // simple encrypt/decrypt
                let key = obj.val;
                let encHex = await this.symEncryptString(key, clearText);
                let unencText = await this.symDecryptString(key, encHex);
                S.util.assert(clearText === unencText, "Symmetric decrypt");

                // test symetric key export/import
                let keyDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, key);
                let key2: CryptoKey = await crypto.subtle.importKey(this.KEY_SAVE_FORMAT, keyDat, this.SYM_ALGO, true, this.OP_ENC_DEC);

                let encHex2 = await this.symEncryptString(key2, clearText);
                let unencText2 = await this.symDecryptString(key2, encHex2);
                S.util.assert(clearText === unencText2, "Symetric decrypt, using imported key");
                console.log("sym enc test: OK");
            }

            resolve(true);
        });
    }

    runPublicKeyTest = async (): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            let clearText = "Encrypt this string.";

            // test public key encryption
            let obj: any = await S.localDB.readObject(this.STORE_ASYMKEY);
            if (obj) {
                //results += "STORE_ASYMKEY: \n"+S.util.prettyPrint(obj)+"\n\n";

                // simple encrypt/decrypt
                let encHex = await this.asymEncryptString(obj.val.publicKey, clearText);
                let unencText = await this.asymDecryptString(obj.val.privateKey, encHex);
                S.util.assert(clearText === unencText, "Asym encryption");

                // Export keys to a string format
                let publicKeyStr = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, obj.val.publicKey);
                //console.log("EXPORTED PUBLIC KEY: " + S.util.toJson(publicKeyStr) + "\n");
                let privateKeyStr = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, obj.val.privateKey);
                //console.log("EXPORTED PRIVATE KEY: " + S.util.toJson(publicKeyStr) + "\n");

                let publicKey = await crypto.subtle.importKey(this.KEY_SAVE_FORMAT, publicKeyStr, {
                    name: this.ASYM_ALGO,
                    hash: this.HASH_ALGO,
                }, true, this.OP_ENC);

                let privateKey = await crypto.subtle.importKey(this.KEY_SAVE_FORMAT, privateKeyStr, {
                    name: this.ASYM_ALGO,
                    hash: this.HASH_ALGO,
                }, true, this.OP_DEC);

                let encHex2 = await this.asymEncryptString(publicKey, clearText);
                let unencText2 = await this.asymDecryptString(privateKey, encHex2);
                S.util.assert(clearText === unencText2, "Asym encrypt test using imported keys.");

                console.log("publicKeyTest: OK");
                resolve(true);
            }
        });
    }

    runConversionTest = () => {
        // First test conversion of clear-text string to hex texct, and back.
        let clearText = "Encrypt this string.";
        let clearTextBytes: Uint8Array = this.convertStringToByteArray(clearText);
        let hexOfClearText: string = S.util.buf2hex(clearTextBytes);
        let verifyClearTextBytes: Uint8Array = S.util.hex2buf(hexOfClearText);
        let verifyClearText: string = this.convertByteArrayToString(verifyClearTextBytes);
        S.util.assert(clearText === verifyClearText, "encryption encodings");
        console.log("runConversionTest OK.");
    }

    importKey = async (key: JsonWebKey, algos: any, extractable: boolean, keyUsages: string[]): Promise<CryptoKey> => {
        return crypto.subtle.importKey(S.encryption.KEY_SAVE_FORMAT, key, algos, extractable, keyUsages);
    }

    initKeys = async (forceUpdate: boolean = false, republish: boolean = false) => {
        await this.initAsymetricKeys(forceUpdate, republish);
        await this.initSymetricKey(forceUpdate);
    }

    getPrivateKey = async (): Promise<CryptoKey> => {
        return new Promise<CryptoKey>(async (resolve, reject) => {
            let val: any = await S.localDB.readObject(S.encryption.STORE_ASYMKEY);
            if (!val) {
                reject();
            }
            else {
                resolve(val.val.privateKey);
            }
        });
    }

    getPublicKey = async (): Promise<CryptoKey> => {
        return new Promise<CryptoKey>(async (resolve, reject) => {
            let val: any = await S.localDB.readObject(S.encryption.STORE_ASYMKEY);
            if (!val) {
                reject();
            }
            else {
                resolve(val.val.publicKey);
            }
        });
    }

    initSymetricKey = async (forceUpdate: boolean = false): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let val: any = await S.localDB.readObject(this.STORE_SYMKEY);
                if (!val) {
                    forceUpdate = true;
                }

                if (val && !forceUpdate) {
                    if (this.logKeys) {
                        let cryptoKey: CryptoKey = val.val;
                        let symKeyStr = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, cryptoKey);
                        console.log("symkey: " + S.util.toJson(symKeyStr));
                    }
                }
                else {
                    let key: CryptoKey = await this.genSymKey();
                    S.localDB.writeObject({ name: this.STORE_SYMKEY, val: key });
                }
            }
            finally {
                resolve();
            }
        });
    }

    /* Note: a 'forceUpdate' always triggers the 'republish' */
    initAsymetricKeys = async (forceUpdate: boolean = false, republish: boolean = false): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                /* Check to see if there is a key stored, and if not force it to be created */
                let val: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                if (!val) {
                    forceUpdate = true;
                    republish = true;
                }

                let pubKeyStr;
                if (forceUpdate) {
                    let keyPair: EncryptionKeyPair = await crypto.subtle.generateKey({ //
                        name: this.ASYM_ALGO, //
                        modulusLength: 2048, //
                        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), //
                        hash: { name: this.HASH_ALGO } //
                    }, true, this.OP_ENC_DEC);

                    S.localDB.writeObject({ name: this.STORE_ASYMKEY, val: keyPair });
                    let pubKeyDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, keyPair.publicKey);
                    pubKeyStr = JSON.stringify(pubKeyDat);
                    republish = true;
                }
                else {
                    if (republish) {
                        let val: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                        let keyPair: EncryptionKeyPair = val.val;
                        //let privKeyStr = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, keyPair.privateKey);
                        //console.log("asymPrivKey: " + S.util.toJson(privKeyStr));
                        let publicKeyDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, keyPair.publicKey);
                        pubKeyStr = JSON.stringify(publicKeyDat);
                        console.log("asymPubKey: " + pubKeyStr);
                    }
                }

                if (republish) {
                    S.util.ajax<J.SavePublicKeyRequest, J.SavePublicKeyResponse>("savePublicKey", {
                        keyJson: pubKeyStr
                    }, this.savePublicKeyResponse);
                }
            }
            finally {
                resolve();
            }
        });
    }

    //todo-0: compiler showing lots of syntax errors here in crypto api?
    //Check the official browser spect to find out what's toing on.
    genSymKey = async (): Promise<CryptoKey> => {
        let key: CryptoKey = await window.crypto.subtle.generateKey({
            name: this.SYM_ALGO,
            length: 256
        }, true, this.OP_ENC_DEC);
        return key;
    }

    savePublicKeyResponse = (res: J.SavePublicKeyResponse): void => {
        // alert(res.message);
    }

    /**
     * Returns a string the user can save locally containing all encryption keys stored by Quanta in their browser.
     */
    exportKeys = (): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let ret = "";

            try {
                let obj: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                if (obj) {
                    let keyPair: EncryptionKeyPair = obj.val;
                    let pubDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, keyPair.publicKey);
                    //this.importKey(this.OP_ENCRYPT, "public", this.publicKeyJson);
                    let pubKey = S.util.toJson(pubDat);
                    ret += "Public Key Info:\n" + pubKey + "\n\n";

                    let privDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, keyPair.privateKey);
                    //this.importKey(this.OP_DECRYPT, "private", this.privateKeyJson);
                    let privKey = S.util.toJson(privDat);
                    ret += "Private Key Info:\n" + privKey + "\n\n";
                }

                obj = await S.localDB.readObject(this.STORE_SYMKEY);
                if (obj) {
                    let key: CryptoKey = obj.val;
                    let dat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, key);
                    let keyStr = S.util.toJson(dat);
                    ret += "Symmetric Key Info:\n" + keyStr + "\n\n";
                }
            } finally {
                resolve(ret);
            }
        });
    }

    asymEncryptString = async (key: CryptoKey, data: string): Promise<string> => {
        return this.encryptString(key, this.ASYM_ALGO, data);
    }

    /**
     * Does a simplel symmetric encryption of the data using the given key, and if the key
     * is not provided assumes the STORE_SYMKEY
     */
    symEncryptString = async (key: CryptoKey, data: string): Promise<string> => {
        if (!key) {
            let obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                key = obj.val;
            }
        }
        return this.encryptString(key, this.SYM_ALGO, data);
    }

    symEncryptStringWithCipherKey = async (cipherKey: string, data: string): Promise<string> => {
        let privateKey = await S.encryption.getPrivateKey();
        let symKeyJsonStr: string = await S.encryption.asymDecryptString(privateKey, cipherKey);
        let symKeyJsonObj: JsonWebKey = JSON.parse(symKeyJsonStr);
        let symKey = await S.encryption.importKey(symKeyJsonObj, S.encryption.SYM_ALGO, true, S.encryption.OP_ENC_DEC);
        return await S.encryption.symEncryptString(symKey, data);
    }

    /**
     * This is the primary way of encrypting data that uses a randomly generated symmetric key to
     * do the encryption and then encrypts that symmetric key itself using the Public Key provided, or
     * public key of current user.
     * 
     * This is a very standard approach in the crypto world, and it allows the owner of the associated 
     * keypair (i.e. private key) to be able to share the data securely with arbitrary other users by simply publishing
     * this symmetric key (to the actual data) to individuals by encrypting said symmetric key with that 
     * user's public key.
     * 
     * Of course, this means the process is that when a user wants to read data shared to them they just use 
     * their private key to decrypt the symmetric key to the data, and use that key to get the data.
     * 
     * This function returns an object that contains two properties: ciphertext, cipherkey, which is the encrypted data
     * and the encrypted "JWK" formatted key to the data, respectively
     * 
     * 'publicKey' argument should be the public key of the person doing the encryption (the person doing the encryption) 
     * and if null, it's automatically retrieved from the localDB
     */
    encryptSharableString = async (publicKey: CryptoKey, data: string): Promise<SymKeyDataPackage> => {
        return new Promise<SymKeyDataPackage>(async (resolve, reject) => {
            let ret: SymKeyDataPackage = null;
            try {
                if (!publicKey) {
                    publicKey = await this.getPublicKey();
                }

                //generate random symmetric key
                let symKey: CryptoKey = await this.genSymKey();

                //get JWK formatted key string
                let symKeyJwk = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, symKey);
                let symKeyStr = S.util.toJson(symKeyJwk);

                //encrypt the symetric key
                let cipherKey = await this.asymEncryptString(publicKey, symKeyStr);

                //encrypt the data with the symetric key
                let cipherText = await this.symEncryptString(symKey, data);

                ret = { cipherText, cipherKey };
            }
            finally {
                resolve(ret);
            }
        });
    }

    /* Inverse of  encryptSharableString() function */
    decryptSharableString = async (privateKey: CryptoKey, skpd: SymKeyDataPackage): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let ret: string = null;
            try {
                console.log("decrypting with cipherKey: " + skpd.cipherKey);
                if (!privateKey) {
                    privateKey = await this.getPrivateKey();
                }
                if (!privateKey) {
                    reject();
                    return;
                }
                //Decrypt the symmetric key using our private key
                let symKeyJsonStr: string = await this.asymDecryptString(privateKey, skpd.cipherKey);
                //console.log("Decrypted cipherKey to (asym key to actual data): " + symKeyJsonStr);
                let symKeyJsonObj: JsonWebKey = JSON.parse(symKeyJsonStr);
                let symKey = await crypto.subtle.importKey(this.KEY_SAVE_FORMAT, symKeyJsonObj, this.SYM_ALGO, true, this.OP_ENC_DEC);
                //console.log("DECRYPTING: cipherText: [" + skpd.cipherText + "]");   
                ret = await this.symDecryptString(symKey, skpd.cipherText);
                //console.log("            output: [" + ret + "]");
            }
            catch (ex) {
                // todo-1: this was happening when 'importKey' failed for admin user, but I think admin user may not store keys? Need to just
                // retest encryption 
                // S.util.logAndReThrow("decryptSharableString failed", ex);
            }
            finally {
                resolve(ret);
            }
        });
    }

    /* Encrypts 'data' string and returns a hex representation of the ciphertext */
    encryptString = async (key: CryptoKey, algo: string, data: string): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let encHex = null;
            try {
                let result: ArrayBuffer = await crypto.subtle.encrypt({ name: algo, iv: this.vector }, //
                    key, this.convertStringToByteArray(data));

                let encData = new Uint8Array(result);
                encHex = S.util.buf2hex(encData);
            }
            finally {
                resolve(encHex);
            }
        });
    }

    asymDecryptString = async (key: CryptoKey, encHex: string): Promise<string> => {
        return this.decryptString(key, this.ASYM_ALGO, encHex);
    }

    symDecryptString = async (key: CryptoKey, encHex: string): Promise<string> => {
        if (!key) {
            let obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                key = obj.val;
            }
        }
        return this.decryptString(key, this.SYM_ALGO, encHex);
    }

    /* Takes the input as a hex string, and decrypts it into the original non-hex string */
    decryptString = async (key: CryptoKey, algo: string, encHex: string): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let resStr = null;
            try {
                let encArray: Uint8Array = S.util.hex2buf(encHex);
                let result: ArrayBuffer = await crypto.subtle.decrypt({ name: algo, iv: this.vector }, //
                    key, encArray);
                let resArray = new Uint8Array(result);
                resStr = this.convertByteArrayToString(resArray);
            }
            catch (ex) {
                S.util.logAndReThrow("decrypt FAILED.", ex);
            }
            finally {
                resolve(resStr);
            }
        });
    }

    // NOTE: TextEncoder() and TextDecoder() don't support this yet, so we have these two 
    // functions.
    convertStringToByteArray = (str: string): Uint8Array => {
        let bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            bytes[i] = str.charCodeAt(i);
        }
        return bytes;
    }

    convertByteArrayToString = (buffer: Uint8Array): string => {
        let str = "";
        for (let i = 0; i < buffer.byteLength; i++) {
            str += String.fromCharCode(buffer[i]);
        }
        return str;
    }

    // ab2str = (buf: ArrayBuffer) => {
    //     return String.fromCharCode.apply(null, new Uint16Array(buf));
    // }

    // str2ab = (str) => {
    //     var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    //     var bufView = new Uint16Array(buf);
    //     for (var i = 0, strLen = str.length; i < strLen; i++) {
    //         bufView[i] = str.charCodeAt(i);
    //     }
    //     return buf;
    // }
}
