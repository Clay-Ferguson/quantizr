import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface AttachmentIntf {
    openUploadFromFileDlg(toIpfs: boolean, node: J.NodeInfo, autoAddFile: File, state: AppState): void;
    openUploadFromUrlDlg(node: J.NodeInfo, defaultUrl: string, onUploadFunc: Function, state: AppState): void;
    deleteAttachment(node: J.NodeInfo, state: AppState): Promise<boolean>;
    deleteAttachmentResponse(res: J.DeleteAttachmentResponse, uid: string, state: AppState): void;
    removeBinaryProperties(node: J.NodeInfo): void;
    refreshBinaryPropsFromServer(node: J.NodeInfo): Promise<void>;
}