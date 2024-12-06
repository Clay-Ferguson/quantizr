import { TabBase } from "../../intf/TabBase";
import { BreadcrumbsPanel } from "../BreadcrumbsPanel";
import { Comp } from "../base/Comp";
import { Clearfix } from "./Clearfix";

export class TabHeading extends Comp {

    constructor(children: Comp[], data: TabBase) {
        super();

        if (data) {
            children = children || [];
            children.push(new Clearfix());
            children.push(data?.props?.breadcrumbs ? new BreadcrumbsPanel(data?.props?.breadcrumbs) : null);
        }

        this.children = children;
        this.attribs.className = "headingBar";
    }
}
