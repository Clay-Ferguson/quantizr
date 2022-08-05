import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { TrendingRSInfo } from "../../TrendingRSInfo";
import { TrendingView } from "../TrendingView";

export class TrendingViewData implements TabIntf {
    name = "Trending";
    tooltip = "What's popular right now on the Fediverse";
    id = C.TAB_TRENDING;
    rsInfo = new TrendingRSInfo();
    scrollPos = 0;

    // supports props.filter = hashtags, users, words
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    isVisible = (state: AppState) => true;
    constructView = (data: TabIntf) => new TrendingView(data);
    getTabSubOptions = (state: AppState): Div => {
        return new Div(null, { className: "tabSubOptions" }, [
            new AppNavLink("Hashtags", S.nav.showTrendingHashtags),
            new AppNavLink("Mentions", S.nav.showTrendingMentions),
            new AppNavLink("Words", S.nav.showTrendingWords)
        ]);
    };
}
