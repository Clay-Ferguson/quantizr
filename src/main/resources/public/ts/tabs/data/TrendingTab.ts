import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { TrendingRSInfo } from "../../TrendingRSInfo";
import { TrendingView } from "../TrendingView";

export class TrendingTab implements TabIntf<TrendingRSInfo> {
    name = "Trending";
    tooltip = "What's popular right now on the Fediverse";
    id = C.TAB_TRENDING;
    props = new TrendingRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: TrendingTab = null;
    constructor() {
        TrendingTab.inst = this;
    }

    isVisible = (ast: AppState) => true;
    constructView = (data: TabIntf) => new TrendingView(data);
    getTabSubOptions = (ast: AppState): Div => {
        return new Div(null, { className: "tabSubOptions" }, [
            new AppNavLink("Hashtags", S.nav.showTrendingHashtags),
            new AppNavLink("Mentions", S.nav.showTrendingMentions),
            new AppNavLink("Words", S.nav.showTrendingWords)
        ]);
    };

    findNode = (ast: AppState, nodeId: string): J.NodeInfo => {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    nodeDeleted = (ast: AppState, nodeId: string): void => {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode = (ast: AppState, newNode: J.NodeInfo): void => {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }
}
