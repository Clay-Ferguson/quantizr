import { EncryptionKeyPair } from "../EncryptionKeyPair";

export interface EncryptionIntf {

    KEY_SAVE_FORMAT: string;
    ASYM_ALGO: string;
    HASH_ALGO: string;

    ALGO_OPERATIONS: string[];
    OP_ENCRYPT: string[];
    OP_DECRYPT: string[];

    vector: Uint8Array;

    test(): Promise<string>;
    initKeys(forceUpdate?:boolean): any;
    exportKeys(): Promise<string>;
        
    asymEncryptString(key: CryptoKey, data: string): Promise<string>;
    symEncryptString(key: CryptoKey, data: string): Promise<string>;

    asymDecryptString(key: CryptoKey, encHex: string): Promise<string>;
    symDecryptString(key: CryptoKey, encHex: string): Promise<string>;

    convertStringToByteArray(str): any;
    convertByteArrayToString(buffer): any;
}
