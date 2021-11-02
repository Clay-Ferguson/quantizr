import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface AttachmentIntf {
    openUploadFromFileDlg(toIpfs: boolean, node: J.NodeInfo, autoAddFile: File, state: AppState): void;
    openUploadFromUrlDlg(node: String, defaultUrl: string, onUploadFunc: Function, state: AppState): void;
    openUploadFromTorrentDlg(node: String, defaultUrl: string, onUploadFunc: Function, state: AppState): void;
    openUploadFromIPFSDlg(node: String, defaultCid: string, onUploadFunc: Function, state: AppState): void;
    deleteAttachment(node: J.NodeInfo, state: AppState): Promise<boolean>;
    removeBinaryProperties(node: J.NodeInfo): void;
}
