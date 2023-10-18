import { getAs } from "../../AppContext";
import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class TabHeading extends Div {

    constructor(children: Comp[]) {
        super();
        this.setChildren(children);
        this.attribs.className = getAs().mobileMode ? "headingBarMobile" : "headingBar";
    }
}
