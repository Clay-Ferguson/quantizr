import { CollapsiblePanel } from "./CollapsiblePanel";
import { Html } from "./Html";

export class HelpPanel extends CollapsiblePanel {

    constructor(title: string, html: string, stateCallback: Function = null, expanded: boolean = false, elementName: string = "div", moreStyles: string = "") {
        super(title, title, null, [new Html(html)], false, stateCallback, expanded, "marginRight " + moreStyles, "marginTop helpPanel", elementName);
    }
}
