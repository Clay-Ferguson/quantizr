import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { FollowersRSInfo } from "../../FollowersRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { FollowersResultSetView } from "../FollowersResultSetView";
import * as J from "../../JavaIntf";

export class FollowersResultSetViewData implements TabIntf<FollowersRSInfo> {
    name = "Followers";
    tooltip = "Followers of your account";
    id = C.TAB_FOLLOWERS;
    props = new FollowersRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];

    static inst: FollowersResultSetViewData = null;
    constructor() {
        FollowersResultSetViewData.inst = this;
    }

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_FOLLOWERS);
    constructView = (data: TabIntf) => new FollowersResultSetView<FollowersRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (nodeId: string): J.NodeInfo => {
        return this.props.results.find(n => n.id === nodeId);
    }

    nodeDeleted = (nodeId: string): void => {
        this.props.results = this.props.results.filter(n => nodeId !== n.id);
    }

}
