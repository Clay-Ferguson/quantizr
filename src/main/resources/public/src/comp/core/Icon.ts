import { getAs } from "../../AppContext";
import { Comp } from "../base/Comp";

export class Icon extends Comp {

    constructor(attribs: any = null, private label: string = null) {
        super(attribs);
        this.attribs.className += getAs().mobileMode ? " appIcon mobileIcon" : " appIcon";
        this.tag = "i";
    }

    override preRender(): boolean | null {
        this.children = [this.label];
        return true;
    }
}
