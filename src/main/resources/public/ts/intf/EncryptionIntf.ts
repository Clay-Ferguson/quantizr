
export interface EncryptionIntf {

    DEFAULT_KEY_FORMAT: string;
    ASYM_ALGO: string;
    SYM_ALGO: string;
    HASH_ALGO: string;
    ASYM_IMPORT_ALGO: any;
    STORE_ASYMKEY: string;

    OP_ENC_DEC: string[];
    OP_ENC: string[];
    OP_DEC: string[];

    vector: Uint8Array;

    test(): Promise<string>;
    initKeys(forceUpdate?:boolean, republish?: boolean): any;
    exportKeys(): Promise<string>;

    asymEncryptString(key: CryptoKey, data: string): Promise<string>;
    symEncryptString(key: CryptoKey, data: string): Promise<string>;
    symEncryptStringWithCipherKey(cipherKey: string, data: string): Promise<string>;

    asymDecryptString(key: CryptoKey, encHex: string): Promise<string>;
    symDecryptString(key: CryptoKey, encHex: string): Promise<string>;

    convertStringToByteArray(str): any;
    convertByteArrayToString(buffer): any;

    encryptSharableString(publicKey: CryptoKey, data: string): Promise<SymKeyDataPackage>;
    decryptSharableString(privateKey: CryptoKey, skpd: SymKeyDataPackage): Promise<string>;

    getPrivateKey(): Promise<CryptoKey>;
    getPublicKey(): Promise<CryptoKey>;

    // todo-1: there's lots of places i pass 'extractable=true' and also more keyUsages than required. See if limiting those wokrs, because
    // doing so is bound to help performance and resources
    importKey(key: JsonWebKey, algos: any, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>;

    importKeyPair(keyPair: string): Promise<boolean>;
}

export interface SymKeyDataPackage {
    cipherText: string;
    cipherKey: string;
    symKey?: CryptoKey;
}
