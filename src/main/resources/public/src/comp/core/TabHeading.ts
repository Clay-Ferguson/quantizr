import { getAs } from "../../AppContext";
import { CompIntf } from "../base/CompIntf";
import { Div } from "./Div";

export class TabHeading extends Div {

    constructor(children: CompIntf[]) {
        super();
        this.setChildren(children);
        this.attribs.className = getAs().mobileMode ? "headingBarMobile" : "headingBar";
    }
}
