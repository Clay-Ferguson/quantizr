import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { TrendingRSInfo } from "../TrendingRSInfo";
import { AppTab } from "../widget/AppTab";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Span } from "../widget/Span";
import { FeedView } from "./FeedView";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TrendingView extends AppTab {

    loaded: boolean = false;

    constructor(data: TabDataIntf) {
        super(data);

        PubSub.subSingleOnce(C.PUBSUB_tabChanging, (tabName: string) => {
            // console.log("Tab Changing recieved in TrendingView: " + tabName);
            if (tabName === C.TAB_TRENDING) {

                // only ever do this once, just to save CPU load on server.
                if (this.loaded) return;
                this.loaded = true;
                this.refresh();
            }
        });
    }

    refresh = (): void => {
        S.util.ajax<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: null,
            trending: true,
            feed: true
        },
            (res: J.GetNodeStatsResponse) => {
                dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                    let data = s.tabData.find(d => d.id === C.TAB_TRENDING);
                    if (!data) return;
                    (data.rsInfo as TrendingRSInfo).res = res;
                    return s;
                });
            });
    }

    /* This code is [almost] duplicated in NodeStatsDlg for now (todo-0) */
    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        let data = state.tabData.find(d => d.id === C.TAB_TRENDING);
        let res = data ? (data.rsInfo as TrendingRSInfo).res : null;

        if (!res) {
            this.setChildren([new Div("Loading...")]);
            return;
        }

        let tagPanel = new Div(null, { className: "trendingWordStatsArea" });
        if (res.topTags && res.topTags.length > 0) {
            tagPanel.addChild(new Heading(4, "Hashtags"));
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
            mentionPanel.addChild(new Heading(4, "Mentions"));
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
            wordPanel.addChild(new Heading(4, "Words"));
            res.topWords.forEach((word: string) => {
                wordPanel.addChild(new Span(word, {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        this.setChildren([
            new Heading(3, "Trending", { className: "trendingTitle" }),
            new Div("Click any word below...", { className: "marginBottom" }),

            // this should be correct data but we don't need it here.
            // new TextContent(res.stats, null, false),

            tagPanel.childrenExist() ? tagPanel : null,
            mentionPanel && mentionPanel.childrenExist() ? mentionPanel : null,
            wordPanel.childrenExist() ? wordPanel : null
        ]);
    }

    searchWord = (evt: Event) => {
        let word = S.util.getPropFromDom(evt, "word");
        if (!word) return;
        FeedView.searchTextState.setValue(word);
        S.nav.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToPublic: true,
            feedFilterLocalServer: false
        });
    }
}
