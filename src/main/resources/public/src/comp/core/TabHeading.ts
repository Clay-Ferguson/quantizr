import { getAs } from "../../AppContext";
import { TabIntf } from "../../intf/TabIntf";
import { BreadcrumbsPanel } from "../BreadcrumbsPanel";
import { Comp } from "../base/Comp";
import { Clearfix } from "./Clearfix";
import { Div } from "./Div";

export class TabHeading extends Div {

    constructor(children: Comp[], data: TabIntf) {
        super();

        if (data) {
            children = children || [];
            children.push(new Clearfix());
            children.push(!getAs().mobileMode && data?.props?.breadcrumbs ? new BreadcrumbsPanel(data?.props?.breadcrumbs) : null);
        }

        this.children = children;
        this.attribs.className = getAs().mobileMode ? "headingBarMobile" : "headingBar";
    }
}
