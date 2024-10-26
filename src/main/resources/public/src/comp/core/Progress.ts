import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class Progress extends Comp {

    constructor() {
        super({
            role: "progressbar",
            style: { width: "100%" },
            className: "tw-flex tw-justify-center tw-items-center"
        });
    }

    override preRender(): boolean | null {
        this.children = [new Div(null, {
            className: "tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-4 tw-border-green-500 tw-border-t-transparent",
        })];
        return true;
    }
}
