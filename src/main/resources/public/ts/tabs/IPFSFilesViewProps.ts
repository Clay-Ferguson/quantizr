import * as J from "../JavaIntf";
import { ValidatedState } from "../ValidatedState";

export interface IPFSFilesViewProps {
    loading?: boolean;

    listCids?: boolean;
    mfsFolderCid?: string;
    cidField?: ValidatedState<any>;

    // MFS FilesView support
    mfsFiles?: J.MFSDirEntry[]; // files retrieved from MFS
}
