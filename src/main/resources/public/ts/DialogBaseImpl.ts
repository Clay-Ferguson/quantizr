import { CompIntf } from "./widget/base/CompIntf";

export interface DialogBaseImpl {
    extraHeaderComps: CompIntf[];

    open(display?: string): Promise<CompIntf>;
    init() : void;
    close(): void;
}

