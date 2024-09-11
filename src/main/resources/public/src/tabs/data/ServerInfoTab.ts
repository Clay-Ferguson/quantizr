import { getAs } from "../../AppContext";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { ServerInfoView } from "../ServerInfoView";

export class ServerInfoTab extends TabBase<any> {
    name = "Info View";
    tooltip = "Displaying the information view for the most recently requested info";
    id = C.TAB_SERVERINFO;

    static inst: ServerInfoTab = null;
    constructor() {
        super();
        ServerInfoTab.inst = this;
    }

    isVisible() {
        return !!getAs().serverInfoText;
    };

    constructView(data: TabBase) {
        return new ServerInfoView(data);
    }
}
