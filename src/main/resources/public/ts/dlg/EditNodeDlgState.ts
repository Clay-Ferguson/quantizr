export interface LS { // Local State
    selectedProps?: Set<string>;
    selectedAttachments?: Set<string>;
    toIpfs?: boolean;
    speechActive?: boolean;
    signCheckboxVal?: boolean;
    encryptCheckboxVal?: boolean;
}
