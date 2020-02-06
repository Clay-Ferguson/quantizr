import * as I from "./Interfaces";
import * as J from "./JavaIntf";
import { EncryptionKeyPair } from "./EncryptionKeyPair";
import { EncryptionIntf } from "./intf/EncryptionIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/*
PUBLIC KEY ENCRYPTION
---------------------
This class is for proof-of-concept work related to doing Public Key Encryption in the browser using the
WebCryptoAPI, for a "Secure Messaging" feature of Quantizr. Currently the way this test is run is simply via
a call to 'encryption.test()' from an admin option

We will be using LocalDB.ts implementation to store the keys in the browser, but we will also support
allowing the user to cut-n-paste they Key JSON, so that if something goes wrong with the
browser storage the user will not loose their keys because they wil be able
to reimport the JSON key text back in at any time, or put keys in a different browser.

At no point in time does the users' Private Key ever leave their own machine. Is never sent down the wire, and
not even any encrypted copy is ever sent down the wire either for the best-practices that are available for
Secure Messaging, short of special-purpose hardware key-storage

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

    ALGO_OPERATIONS = ["encrypt", "decrypt"];
    OP_ENCRYPT: string[] = ["encrypt"];
    OP_DECRYPT: string[] = ["decrypt"];

    vector: Uint8Array = null;

    constructor() {

        /* WARNING: Crypto (or at least subtle) will not be available except on Secure Origin, which means a SSL (https) 
        web address plus also localhost */

        if (!crypto || !crypto.subtle) {
            console.log("WebCryptoAPI not available");
            return;
        }

        /* Note: This is not a mistake to have this vector publicly visible. It's not a security risk. This vector is merely required
        to be large enough and random enough, but is not required to be secret. 16 randomly chosen prime numbers. 
        WARNING: If you change this you will NEVER be able to recover any data encrypted with it in effect, even with the correct password. So 
        beware if you change this you've basically lost ALL your passwords. So just don't change it.

        todo-1: Some crypto experts told me this IV should not be reused like this but instead stored along with the encryption key.
        */
        //iv = window.crypto.getRandomValues(new Uint8Array(16)); <--- I saw this in a reputable example. Try it out!
        this.vector = new Uint8Array([71, 73, 79, 83, 89, 37, 41, 47, 53, 67, 97, 103, 107, 109, 127, 131]);
    }

    asymKeyTest = async (): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let results = "";

            // first test converters
            let clearText = "Encrypt this string.";
            let clearTextBytes: Uint8Array = this.convertStringToByteArray(clearText);
            let hexOfClearText: string = S.util.buf2hex(clearTextBytes);
            let verifyClearTextBytes: Uint8Array = S.util.hex2buf(hexOfClearText);
            let verifyClearText: string = this.convertByteArrayToString(verifyClearTextBytes);
            let encodingResults = clearText === verifyClearText ? "Successful." : "Failed.";
            results += "Encoding: " + encodingResults + "\n";

            // test public key encryption
            let obj: any = await S.localDB.readObject(this.STORE_ASYMKEY);
            if (obj) {
                // simple encrypt/decrypt
                let encHex = await this.asymEncryptString(obj.val.publicKey, clearText);
                let unencText = await this.asymDecryptString(obj.val.privateKey, encHex);
                let encResults = clearText === unencText ? "Successful." : "Failed.";
                results += "Public Key Encryption: " + encResults + "\n";

                // test asymetric key export/import
                let pubKeyDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, obj.val.publicKey);
                let privKeyDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, obj.val.privateKey);

                let pubKey2 = await crypto.subtle.importKey(this.KEY_SAVE_FORMAT, pubKeyDat, {
                    name: this.ASYM_ALGO,
                    hash: this.HASH_ALGO,
                }, true, this.OP_ENCRYPT);
                let privKey2 = await crypto.subtle.importKey(this.KEY_SAVE_FORMAT, privKeyDat, {
                    name: this.ASYM_ALGO,
                    hash: this.HASH_ALGO,
                }, true, this.OP_DECRYPT);

                let encHex2 = await this.asymEncryptString(pubKey2, clearText);
                let unencText2 = await this.asymDecryptString(privKey2, encHex2);
                let encResults2 = clearText === unencText2 ? "Successful." : "Failed.";
                results += "Public Key Encryption (imported key): " + encResults2 + "\n";
            }

            // test symetric encryption
            obj = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                // simple encrypt/decrypt
                let key = obj.val;
                let encHex = await this.symEncryptString(key, clearText);
                let unencText = await this.symDecryptString(key, encHex);
                let encResults = clearText === unencText ? "Successful." : "Failed.";
                results += "Symmetric Encryption: " + encResults + "\n";

                // test symetric key export/import
                let keyDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, key);
                let key2 = await crypto.subtle.importKey(this.KEY_SAVE_FORMAT, keyDat, this.SYM_ALGO, true, this.ALGO_OPERATIONS);

                let encHex2 = await this.symEncryptString(key2, clearText);
                let unencText2 = await this.symDecryptString(key2, encHex2);
                let encResults2 = clearText === unencText2 ? "Successful." : "Failed.";
                results += "Symmetric Encryption (imported key): " + encResults2 + "\n";
            }

            resolve(results);
        });
    }

    initKeys = async (forceUpdate: boolean = false) => {
        await this.initAsymetricKeys(forceUpdate);
        await this.initSymetricKey(forceUpdate);
    }

    initSymetricKey = async (forceUpdate: boolean = false): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            let val = await S.localDB.readObject(this.STORE_SYMKEY);

            if (val && !forceUpdate) {
                console.log("symkey: " + S.util.toJson(val));
            }
            else {
                /* NOTE: These parameters are all production-ready 
                https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
                */
                let key: CryptoKey = await window.crypto.subtle.generateKey({
                    name: this.SYM_ALGO,
                    length: 256
                }, true, this.ALGO_OPERATIONS);

                S.localDB.writeObject({ name: this.STORE_SYMKEY, val: key });
                resolve();
            }
        });
    }

    initAsymetricKeys = async (forceUpdate: boolean = false): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            let val = await S.localDB.readObject(this.STORE_ASYMKEY);

            if (val && !forceUpdate) {
                //console.log("AsymKey: " + S.util.toJson(val));
            }
            else {
                /* NOTE: These parameters are all production-ready 
                https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
                */
                let keyPair: EncryptionKeyPair = await crypto.subtle.generateKey({ //
                    name: this.ASYM_ALGO, //
                    modulusLength: 2048, //
                    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), //
                    hash: { name: this.HASH_ALGO } //
                }, true, this.ALGO_OPERATIONS);

                S.localDB.writeObject({ name: this.STORE_ASYMKEY, val: keyPair });
                let pubKeyDat = await crypto.subtle.exportKey(this.KEY_SAVE_FORMAT, keyPair.publicKey);
                let pubKeyStr = JSON.stringify(pubKeyDat);

                S.util.ajax<J.SavePublicKeyRequest, J.SavePublicKeyResponse>("savePublicKey", {
                    "keyJson": pubKeyStr
                }, this.savePublicKeyResponse);

                resolve();
            }
        });
    }

    savePublicKeyResponse = (res: J.SavePublicKeyResponse): void => {
       // alert(res.message);
    }

    /**
     * Returns a string the user can save locally containing all encryption keys stored by Quantizr in their browser.
     */
    exportKeys = (): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let ret = "";

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

            resolve(ret);
        });
    }

    asymEncryptString = async (key: CryptoKey, data: string): Promise<string> => {
        return this.encryptString(key, this.ASYM_ALGO, data);
    }

    symEncryptString = async (key: CryptoKey, data: string): Promise<string> => {
        if (!key) {
            let obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                key = obj.val;
            }
        }
        return this.encryptString(key, this.SYM_ALGO, data);
    }

    /* Takes the input string, and encrypts it and then returns a hex representation of the data */
    encryptString = async (key: CryptoKey, algo: string, data: string): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            let result: ArrayBuffer = await crypto.subtle.encrypt({ name: algo, iv: this.vector }, //
                key, this.convertStringToByteArray(data));

            let encData = new Uint8Array(result);
            let encHex = S.util.buf2hex(encData);
            resolve(encHex);
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
            let encArray: Uint8Array = S.util.hex2buf(encHex);
            let result: ArrayBuffer = await crypto.subtle.decrypt({ name: algo, iv: this.vector }, //
                key, encArray);
            let resArray = new Uint8Array(result);
            let resStr = this.convertByteArrayToString(resArray);
            resolve(resStr);
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
