import { CompIntf } from "./widget/base/CompIntf";
import { AppState } from "./AppState";

export interface DialogBaseImpl {

    open(display?: string): Promise<CompIntf>;
    close(): void;
    renderDlg(): CompIntf[];
}

