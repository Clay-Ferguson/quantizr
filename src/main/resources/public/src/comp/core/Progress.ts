import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class Progress extends Comp {

    constructor() {
        super({
            role: "progressbar",
            style: { width: "100%" },
            className: "flex justify-center items-center"
        });
    }

    override preRender(): boolean | null {
        this.children = [new Div(null, {
            className: "animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent",
        })];
        return true;
    }
}
