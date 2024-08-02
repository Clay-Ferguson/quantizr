import { getAs } from "../../AppContext";
import { Comp } from "../base/Comp";

export class Icon extends Comp {

    constructor(attribs: any = null, private label: string = null) {
        super(attribs);
        this.attribs.className += getAs().mobileMode ? " mobileIcon" : "";
        this.tag = "i";
    }

    override preRender = (): boolean => {
        this.children = [this.label];
        return true;
    }
}
