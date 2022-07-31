import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { PubSub } from "../../PubSub";
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
    openGraphComps = [];

    isVisible = (state: AppState) => true;
    constructView = (data: TabIntf) => new TrendingView(data);
    getTabSubOptions = (state: AppState): Div => {
        let itemClass = state.mobileMode ? "tabSubOptionsItemMobile" : "tabSubOptionsItem";
        
        return new Div(null, { className: "tabSubOptions" }, [
            new Div("Hashtags", {
                className: itemClass, onClick: () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    S.nav.showTrendingHashtags();
                }
            }),
            new Div("Mentions", {
                className: itemClass, onClick: () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    S.nav.showTrendingMentions();
                }
            }),
            new Div("Words", {
                className: itemClass, onClick: () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    S.nav.showTrendingWords();
                }
            })
        ]);
    };
}
