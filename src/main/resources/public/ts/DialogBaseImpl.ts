import { CompIntf } from "./widget/base/CompIntf";

console.log("DialogBaseImpl.ts");

export interface DialogBaseImpl {
    open(): Promise<CompIntf>;
    init() : void;
    close(): void;
}
