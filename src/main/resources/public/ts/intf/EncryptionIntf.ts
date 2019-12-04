import { EncryptionKeyPair } from "../EncryptionKeyPair";

console.log("EncryptionIntf.ts");

export interface EncryptionIntf {

    KEY_SAVE_FORMAT: string;
    ASYM_ALGO: string;
    HASH_ALGO: string;

    ALGO_OPERATIONS;
    OP_ENCRYPT: string[];
    OP_DECRYPT: string[];

    vector: Uint8Array;

    asymKeyTest(): Promise<string>;
    initKeys(forceUpdate?:boolean): any;
    exportKeys(): Promise<string>;
        
    asymEncryptString(key: CryptoKey, data: string): Promise<string>;
    symEncryptString(key: CryptoKey, data: string): Promise<string>;

    asymDecryptString(key: CryptoKey, encHex: string): Promise<string>;
    symDecryptString(key: CryptoKey, encHex: string): Promise<string>;

    convertStringToByteArray(str);
    convertByteArrayToString(buffer);
}
