import { ReactNode } from "react";
import { State } from "../../State";
import { Comp } from "../base/Comp";

interface LS {
    value: string;
}

export class Input extends Comp {

    constructor(attribs: Object = {}, s?: State) {
        super(attribs, s);
        this.attribs.onChange = (evt) => {
            this.mergeState<LS>({ value: evt.target.value });
        };
    }

    compRender(): ReactNode {
        this.attribs.value = this.getState<LS>().value || "";
        return this.e("input", this.attribs);
    }
}
