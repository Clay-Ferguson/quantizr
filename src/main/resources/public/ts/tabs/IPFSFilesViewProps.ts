import * as J from "../JavaIntf";
import { Validator } from "../Validator";

export interface IPFSFilesViewProps {
    loading?: boolean;

    listCids?: boolean;
    mfsFolderCid?: string;
    cidField?: Validator;

    // MFS FilesView support
    mfsFiles?: J.MFSDirEntry[]; // files retrieved from MFS
}
