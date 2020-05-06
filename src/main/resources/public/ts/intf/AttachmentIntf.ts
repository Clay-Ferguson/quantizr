import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { AppState } from "../AppState";

export interface AttachmentIntf {
    openUploadFromFileDlg(toIpfs: boolean, node: J.NodeInfo, autoAddFile: File, state: AppState): void;
    openUploadFromUrlDlg(node: J.NodeInfo, defaultUrl: string, state: AppState): void;
    deleteAttachment(state: AppState): void;
    deleteAttachmentResponse(res: J.DeleteAttachmentResponse, uid: string, state: AppState): void;
}