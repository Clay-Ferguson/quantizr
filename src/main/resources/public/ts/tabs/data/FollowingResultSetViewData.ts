import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { FollowingRSInfo } from "../../FollowingRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { FollowingResultSetView } from "../FollowingResultSetView";
import * as J from "../../JavaIntf";

export class FollowingResultSetViewData implements TabIntf<FollowingRSInfo> {
    name = "Following";
    tooltip = "List of people the person is following";
    id = C.TAB_FOLLOWING;
    props = new FollowingRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];

    static inst: FollowingResultSetViewData = null;
    constructor() {
        FollowingResultSetViewData.inst = this;
    }

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_FOLLOWING);
    constructView = (data: TabIntf) => new FollowingResultSetView<FollowingRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (nodeId: string): J.NodeInfo => {
        return this.props.results.find(n => n.id === nodeId);
    }

    nodeDeleted = (nodeId: string): void => {
        this.props.results = this.props.results.filter(n => nodeId !== n.id);
    }
}
