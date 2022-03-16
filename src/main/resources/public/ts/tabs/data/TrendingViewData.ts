import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { TrendingRSInfo } from "../../TrendingRSInfo";
import { TrendingView } from "../TrendingView";

export class TrendingViewData implements TabIntf {
    name = "Trending";
    id = C.TAB_TRENDING;
    rsInfo = new TrendingRSInfo();
    scrollPos = 0;

    // supports props.filter = hashtags, users, words
    props = {};
    openGraphComps = [];

    isVisible = () => true;
    constructView = (data: TabIntf) => new TrendingView(data);
    getTabSubOptions = (state: AppState): Div => {
        return new Div(null, { className: "tabSubOptions" }, [
            new Div("Hashtags", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingHashtags }),
            new Div("Mentions", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingMentions }),
            new Div("Words", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingWords })
        ]);
    };
}
