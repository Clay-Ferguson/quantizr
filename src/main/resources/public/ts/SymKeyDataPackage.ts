export interface SymKeyDataPackage {
    cipherText: string;
    cipherKey: string;
    symKey?: CryptoKey;
}
