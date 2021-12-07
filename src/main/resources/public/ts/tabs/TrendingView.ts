import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { TrendingRSInfo } from "../TrendingRSInfo";
import { AppTab } from "../comp/AppTab";
import { Div } from "../comp/Div";
import { Heading } from "../comp/Heading";
import { Span } from "../comp/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TrendingView extends AppTab {

    loaded: boolean = false;

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;

        PubSub.subSingleOnce(C.PUBSUB_tabChanging, (tabName: string) => {
            // console.log("Tab Changing recieved in TrendingView: " + tabName);
            if (tabName === this.data.id) {

                // only ever do this once, just to save CPU load on server.
                if (this.loaded) return;
                this.loaded = true;
                this.refresh();
            }
        });
    }

    refresh = async () => {
        let res: J.GetNodeStatsResponse = await S.util.ajax<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: null,
            trending: true,
            feed: true
        });
        dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
            let data = s.tabData.find(d => d.id === this.data.id);
            if (!data) return;
            (data.rsInfo as TrendingRSInfo).res = res;
            return s;
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        this.attribs.className = this.getClass(state);

        let data = state.tabData.find(d => d.id === this.data.id);
        let res = data ? (data.rsInfo as TrendingRSInfo).res : null;

        if (!res) {
            this.setChildren([new Heading(4, "Generating statistics...")]);
            return;
        }

        let tagPanel = new Div(null, { className: "trendingWordStatsArea" });
        if (res.topTags && res.topTags.length > 0) {
            tagPanel.addChild(new Heading(4, "Hashtags", { className: "trendingSectionTitle" }));
            res.topTags.forEach((word: string) => {
                tagPanel.addChild(new Span(word, {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        let mentionPanel = new Div(null, { className: "trendingWordStatsArea" });
        if (res.topMentions && res.topMentions.length > 0) {
            mentionPanel.addChild(new Heading(4, "Mentions", { className: "trendingSectionTitle" }));
            res.topMentions.forEach((word: string) => {
                mentionPanel.addChild(new Span(word, {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        let wordPanel = new Div(null, { className: "trendingWordStatsArea" });
        if (res.topWords && res.topWords.length > 0) {
            wordPanel.addChild(new Heading(4, "Words", { className: "trendingSectionTitle" }));
            res.topWords.forEach((word: string) => {
                wordPanel.addChild(new Span(word, {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        this.setChildren([
            new Heading(3, "Trending: Top 100s", { className: "trendingTitle" }),
            new Div("Words listed by frequency of use. Click one to search...", { className: "marginBottom" }),

            // this should be correct data but we don't need it here.
            // new TextContent(res.stats, null, false),

            tagPanel.hasChildren() ? tagPanel : null,
            mentionPanel && mentionPanel.hasChildren() ? mentionPanel : null,
            wordPanel.hasChildren() ? wordPanel : null
        ]);
    }

    searchWord = (evt: Event) => {
        let word = S.util.getPropFromDom(evt, "word");
        if (!word) return;

        // expand so users can see what's going on with the search string and know they can clear it.
        // If feed tab exists, expand the filter part
        let feedData = S.quanta.getTabDataById(null, C.TAB_FEED);
        if (feedData) {
            feedData.props.searchTextState.setValue(word);
        }

        S.nav.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null
        });
    }
}
