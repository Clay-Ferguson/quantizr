import { getAs } from "../../AppContext";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { RSSView } from "../RSSView";

export class RSSTab extends TabBase<any> {
    name = "RSS Feed";
    tooltip = "Get some news or podcasts";
    id = C.TAB_RSS;
    static inst: RSSTab = null;

    constructor() {
        super();
        RSSTab.inst = this;
    }

    isVisible() {
        return !!getAs().rssNode;
    }

    constructView(data: TabBase<any>) {
        return new RSSView(data);
    }
}
