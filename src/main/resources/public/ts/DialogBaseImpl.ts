import { CompIntf } from "./comp/base/CompIntf";

export interface DialogBaseImpl {

    open(display?: string): Promise<CompIntf>;
    close(): void;
    renderDlg(): CompIntf[];
}
