import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface AttachmentIntf {
    uploadNode: any;

    openUploadFromFileDlg(): void;
    openUploadFromUrlDlg(): void;
    deleteAttachment(): void;
    deleteAttachmentResponse(res: I.DeleteAttachmentResponse, uid: string): void;
}