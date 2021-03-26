import { Constants as C } from "./Constants";
import { EncryptionKeyPair } from "./EncryptionKeyPair";
import { EncryptionIntf, SymKeyDataPackage } from "./intf/EncryptionIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

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

    static FORMAT_JWK: string = "jwk";
    static FORMAT_PEM: string = "pem";

    // asymetric keys (public/private)
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
        hash: "SHA-256"
    };

    OP_ENC_DEC: KeyUsage[] = ["encrypt", "decrypt"];
    OP_ENC: KeyUsage[] = ["encrypt"];
    OP_DEC: KeyUsage[] = ["decrypt"];

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

        todo-2: According to some crypto experts, this initialization vector should not be reused like this but instead stored
        along with the encryption key.
        */
        // iv = window.crypto.getRandomValues(new Uint8Array(16)); <--- I saw this in a reputable example. Try it out!
        this.vector = new Uint8Array([71, 73, 79, 83, 89, 37, 41, 47, 53, 67, 97, 103, 107, 109, 127, 131]);
    }

    /* Runs a full test of all encryption code.

       Assumes that Encryption.initKeys() has previously been called, which is
       safe to assume because we run it during app initialization.
    */
    test = async (): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            const results = "";
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
                const clearText = "This is cleartext";
                const skdp: SymKeyDataPackage = await this.encryptSharableString(null, clearText);
                const checkText = await this.decryptSharableString(null, skdp);
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
            try {
                const clearText = "Encrypt this string.";

                // test symetric encryption
                const obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
                if (obj) {
                    // simple encrypt/decrypt
                    const key: CryptoKey = obj.val;
                    const encHex = await this.symEncryptString(key, clearText);
                    const unencText = await this.symDecryptString(key, encHex);
                    S.util.assert(clearText === unencText, "Symmetric decrypt");

                    // test symetric key export/import
                    const keyDat: JsonWebKey = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, key) as JsonWebKey;

                    const key2: CryptoKey = await crypto.subtle.importKey(Encryption.FORMAT_JWK, keyDat, this.SYM_ALGO /* as AlgorithmIdentifier */, true, this.OP_ENC_DEC as KeyUsage[]);

                    const encHex2 = await this.symEncryptString(key2, clearText);
                    const unencText2 = await this.symDecryptString(key2, encHex2);
                    S.util.assert(clearText === unencText2, "Symetric decrypt, using imported key");
                    console.log("sym enc test: OK");
                }
            }
            finally {
                resolve(true);
            }
        });
    }

    runPublicKeyTest = async (): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            const clearText = "Encrypt this string.";
            let ret: boolean = false;

            try {
                // test public key encryption
                const obj: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                if (obj) {
                    // results += "STORE_ASYMKEY: \n"+S.util.prettyPrint(obj)+"\n\n";

                    // simple encrypt/decrypt
                    const encHex = await this.asymEncryptString(obj.val.publicKey, clearText);
                    const unencText = await this.asymDecryptString(obj.val.privateKey, encHex);
                    S.util.assert(clearText === unencText, "Asym encryption");

                    // Export keys to a string format
                    const publicKeyStr = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, obj.val.publicKey);
                    // console.log("EXPORTED PUBLIC KEY: " + S.util.toJson(publicKeyStr) + "\n");
                    const privateKeyStr = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, obj.val.privateKey);
                    // console.log("EXPORTED PRIVATE KEY: " + S.util.toJson(publicKeyStr) + "\n");

                    const publicKey = await crypto.subtle.importKey(Encryption.FORMAT_JWK, publicKeyStr, {
                        name: this.ASYM_ALGO,
                        hash: this.HASH_ALGO
                    }, true, this.OP_ENC);

                    const privateKey = await crypto.subtle.importKey(Encryption.FORMAT_JWK, privateKeyStr, {
                        name: this.ASYM_ALGO,
                        hash: this.HASH_ALGO
                    }, true, this.OP_DEC);

                    const encHex2 = await this.asymEncryptString(publicKey, clearText);
                    const unencText2 = await this.asymDecryptString(privateKey, encHex2);
                    S.util.assert(clearText === unencText2, "Asym encrypt test using imported keys.");

                    console.log("publicKeyTest: OK");
                    ret = true;
                }
            } finally {
                resolve(ret);
            }
        });
    }

    runConversionTest = () => {
        // First test conversion of clear-text string to hex texct, and back.
        const clearText = "Encrypt this string.";
        const clearTextBytes: Uint8Array = this.convertStringToByteArray(clearText);
        const hexOfClearText: string = S.util.buf2hex(clearTextBytes);
        const verifyClearTextBytes: Uint8Array = S.util.hex2buf(hexOfClearText);
        const verifyClearText: string = this.convertByteArrayToString(verifyClearTextBytes);
        S.util.assert(clearText === verifyClearText, "encryption encodings");
        console.log("runConversionTest OK.");
    }

    importKey = async (key: JsonWebKey, algos: any, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey> => {
        return crypto.subtle.importKey(Encryption.FORMAT_JWK, key, algos, extractable, keyUsages);
    }

    importKeyPair = async (keyPair: string): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            let ret: boolean = false;
            try {
                const keyPairObj: EncryptionKeyPair = JSON.parse(keyPair);

                const publicKey = await crypto.subtle.importKey(Encryption.FORMAT_JWK, keyPairObj.publicKey, {
                    name: this.ASYM_ALGO,
                    hash: this.HASH_ALGO
                }, true, this.OP_ENC as KeyUsage[]);

                const privateKey = await crypto.subtle.importKey(Encryption.FORMAT_JWK, keyPairObj.privateKey, {
                    name: this.ASYM_ALGO,
                    hash: this.HASH_ALGO
                }, true, this.OP_DEC as KeyUsage[]);

                if (publicKey && privateKey) {
                    const newKeyPair: EncryptionKeyPair = new EncryptionKeyPair(publicKey, privateKey);
                    S.localDB.writeObject({ name: this.STORE_ASYMKEY, val: newKeyPair });
                }
                ret = true;
            }
            catch (e) {
                // leave ret == false.
            }
            finally {
                resolve(ret);
            }
        });
    }

    initKeys = async (forceUpdate: boolean = false, republish: boolean = false) => {
        await this.initAsymetricKeys(forceUpdate, republish);
        await this.initSymetricKey(forceUpdate);
    }

    getPrivateKey = async (): Promise<CryptoKey> => {
        return new Promise<CryptoKey>(async (resolve, reject) => {
            const val: any = await S.localDB.readObject(S.encryption.STORE_ASYMKEY);
            if (!val) {
                reject();
            }
            else {
                // console.log("getPrivateKey returning: " + S.util.prettyPrint(val.val.privateKey));
                resolve(val.val.privateKey);
            }
        });
    }

    getPublicKey = async (): Promise<CryptoKey> => {
        return new Promise<CryptoKey>(async (resolve, reject) => {
            const val: any = await S.localDB.readObject(S.encryption.STORE_ASYMKEY);
            if (!val) {
                reject();
            }
            else {
                // console.log("getPublicKey returning: " + S.util.prettyPrint(val.val.publicKey));
                resolve(val.val.publicKey);
            }
        });
    }

    initSymetricKey = async (forceUpdate: boolean = false): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const val: any = await S.localDB.readObject(this.STORE_SYMKEY);
                if (!val) {
                    forceUpdate = true;
                }

                if (val && !forceUpdate) {
                    if (this.logKeys) {
                        const cryptoKey: CryptoKey = val.val;
                        await crypto.subtle.exportKey(Encryption.FORMAT_JWK, cryptoKey);
                        // let symKeyStr = await crypto.subtle.exportKey(this.DEFAULT_KEY_FORMAT, cryptoKey);
                        // console.log("symkey: " + S.util.toJson(symKeyStr));
                    }
                }
                else {
                    const key: CryptoKey = await this.genSymKey();
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
                let keyPair: EncryptionKeyPair = null;
                let pubKeyStr: string = null;

                if (!forceUpdate) {
                    /* Check to see if there is a key stored, and if not force it to be created
                       val.val is the EncryptionKeyPair here.
                    */
                    const val: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                    if (!val) {
                        forceUpdate = true;
                    }
                }

                if (forceUpdate) {
                    keyPair = await crypto.subtle.generateKey({ //
                        name: this.ASYM_ALGO, //
                        modulusLength: 2048, //
                        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), //
                        hash: { name: this.HASH_ALGO } //
                    }, true, this.OP_ENC_DEC);

                    S.localDB.writeObject({ name: this.STORE_ASYMKEY, val: keyPair });

                    const pubKeyDat = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, keyPair.publicKey);
                    pubKeyStr = JSON.stringify(pubKeyDat);
                    console.log("Exporting key string: " + pubKeyStr);
                    republish = true;
                }

                if (republish) {
                    if (!keyPair) {
                        const val: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                        keyPair = val.val;
                    }

                    if (!pubKeyStr) {
                        const publicKeyDat = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, keyPair.publicKey);
                        pubKeyStr = JSON.stringify(publicKeyDat);
                    }

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

    genSymKey = async (): Promise<CryptoKey> => {
        const key: CryptoKey = await window.crypto.subtle.generateKey({
            name: this.SYM_ALGO,
            length: 256
        }, true, this.OP_ENC_DEC);
        return key;
    }

    savePublicKeyResponse = (res: J.SavePublicKeyResponse): void => {
        S.util.showMessage(res.message, "Publish Public Key");
    }

    /**
     * Returns a string the user can save locally containing all encryption keys stored  in the browser.
     *
     * Export is in JWK format: https://tools.ietf.org/html/rfc7517
     */
    exportKeys = (): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let ret = "";

            try {
                let obj: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                if (obj) {
                    const keyPair: EncryptionKeyPair = obj.val;

                    const pubDat = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, keyPair.publicKey);
                    // this.importKey(this.OP_ENCRYPT, "public", this.publicKeyJson);

                    const privDat = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, keyPair.privateKey);
                    // this.importKey(this.OP_DECRYPT, "private", this.privateKeyJson);

                    ret += "Key Pair (JWK Format):\n" + S.util.toJson({ publicKey: pubDat, privateKey: privDat }) + "\n\n";

                    // yes we export to spki for PEM (not a bug)
                    const privDatSpki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
                    var pem = this.spkiToPEM(privDatSpki);
                    ret += "Public Key (PEM Format):\n" + pem + "\n\n";
                }

                obj = await S.localDB.readObject(this.STORE_SYMKEY);
                if (obj) {
                    const key: CryptoKey = obj.val;
                    const dat = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, key);
                    const keyStr = S.util.toJson(dat);
                    ret += "Symmetric Key (JWK Format):\n" + keyStr + "\n\n";
                }
            } finally {
                resolve(ret);
            }
        });
    }

    spkiToPEM(keydata: any): any {
        const keydataS = this.arrayBufferToString(keydata);
        const keydataB64 = window.btoa(keydataS);
        const keydataB64Pem = this.formatAsPem(keydataB64);
        return keydataB64Pem;
    }

    arrayBufferToString(buffer: any): any {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return binary;
    }

    formatAsPem(str: any): any {
        let finalString = "-----BEGIN PUBLIC KEY-----\n";

        while (str.length > 0) {
            finalString += str.substring(0, 64) + "\n";
            str = str.substring(64);
        }

        finalString = finalString + "-----END PUBLIC KEY-----";
        return finalString;
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
            const obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                key = obj.val;
            }
        }
        return this.encryptString(key, this.SYM_ALGO, data);
    }

    symEncryptStringWithCipherKey = async (cipherKey: string, data: string): Promise<string> => {
        const privateKey = await S.encryption.getPrivateKey();
        const symKeyJsonStr: string = await S.encryption.asymDecryptString(privateKey, cipherKey);
        const symKeyJsonObj: JsonWebKey = JSON.parse(symKeyJsonStr);
        const symKey = await S.encryption.importKey(symKeyJsonObj, S.encryption.SYM_ALGO, true, S.encryption.OP_ENC_DEC);
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

                // generate random symmetric key
                const key: CryptoKey = await this.genSymKey();
                // console.log("Cleartext Sym Key: " + S.util.prettyPrint(key));

                // get JWK formatted key
                const jwk = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, key);

                // get JSON string of jwk
                const jwkJson = S.util.toJson(jwk);

                // const pubKeyJson = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, publicKey);
                // console.log("Initial KEY encrypted with owner publicKey: " + S.util.prettyPrint(pubKeyJson));

                // encrypt the symetric key
                const cipherKey = await this.asymEncryptString(publicKey, jwkJson);

                // encrypt the data with the symetric key
                const cipherText = await this.symEncryptString(key, data);

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

            // get hash of the encrypted data
            let cipherHash: string = S.util.hashOfString(skpd.cipherText);

            // if we have already decrypted this data return the result.
            if (S.meta64.decryptCache.get(cipherHash)) {
                // console.log("decryption cache hit!");
                resolve(S.meta64.decryptCache.get(cipherHash));
                return;
            }

            try {
                // console.log("decrypting [" + skpd.cipherText + "] with cipherKey: " + skpd.cipherKey);
                if (!privateKey) {
                    privateKey = await this.getPrivateKey();
                }

                if (!privateKey) {
                    console.log("unable to get privateKey");
                    reject();
                    return;
                }

                // const privKeyJson = await crypto.subtle.exportKey(Encryption.FORMAT_JWK, privateKey);
                // console.log("calling asymDecryptString to get key: userPrivateKey=" + S.util.prettyPrint(privKeyJson));

                // Decrypt the symmetric key using our private key
                const symKeyJsonStr: string = await this.asymDecryptString(privateKey, skpd.cipherKey);

                const symKeyJsonObj: JsonWebKey = JSON.parse(symKeyJsonStr);
                const symKey = await crypto.subtle.importKey(Encryption.FORMAT_JWK, symKeyJsonObj, this.SYM_ALGO, true, this.OP_ENC_DEC);
                ret = await this.symDecryptString(symKey, skpd.cipherText);
                // console.log("            output: [" + ret + "]");
                S.meta64.decryptCache.set(cipherHash, ret);
            }
            catch (ex) {
                // todo-2: this was happening when 'importKey' failed for admin user, but I think admin user may not store keys? Need to just
                // retest encryption
                S.util.logAndReThrow("decryptSharableString failed", ex);
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
                const result: ArrayBuffer = await crypto.subtle.encrypt({ name: algo, iv: this.vector }, //
                    key, this.convertStringToByteArray(data));

                const encData = new Uint8Array(result);
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
            const obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
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
                const encArray: Uint8Array = S.util.hex2buf(encHex);
                const result: ArrayBuffer = await crypto.subtle.decrypt({ name: algo, iv: this.vector }, //
                    key, encArray);
                const resArray = new Uint8Array(result);
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
        const bytes = new Uint8Array(str.length);
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
