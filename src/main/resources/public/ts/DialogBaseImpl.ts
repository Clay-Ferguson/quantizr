import { CompIntf } from "./widget/base/CompIntf";

export interface DialogBaseImpl {
    open(display?: string): Promise<CompIntf>;
    init() : void;
    close(): void;
}
