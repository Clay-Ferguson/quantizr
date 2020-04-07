import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface AttachmentIntf {
    openUploadFromFileDlg(toIpfs: boolean, node?: J.NodeInfo, autoAddFile?: File): void;
    openUploadFromUrlDlg(node: J.NodeInfo, defaultUrl: string): void;
    deleteAttachment(): void;
    deleteAttachmentResponse(res: J.DeleteAttachmentResponse, uid: string): void;
}