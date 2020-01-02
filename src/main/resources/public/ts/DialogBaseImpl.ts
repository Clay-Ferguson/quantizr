import { CompIntf } from "./widget/base/CompIntf";

export interface DialogBaseImpl {
    open(): Promise<CompIntf>;
    init() : void;
    close(): void;
}
