import { ReactNode } from "react";
import { getAppState } from "../../AppRedux";
import { Comp } from "../base/Comp";

export class Icon extends Comp {

    constructor(attribs: Object = null, private label: string = null) {
        super(attribs);
        this.attribs.className += getAppState().mobileMode ? " mobileIcon" : "";
    }

    compRender = (): ReactNode => {
        return this.tag("i", null, [this.label]);
    }
}
