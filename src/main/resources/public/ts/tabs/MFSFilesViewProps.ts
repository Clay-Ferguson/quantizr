import * as J from "../JavaIntf";

export interface MFSFilesViewProps {
    loading: boolean;

    mfsFolder: string;
    mfsFolderCid: string;

    // MFS FilesView support
    mfsFiles: J.MFSDirEntry[]; // files retrieved from MFS
}
