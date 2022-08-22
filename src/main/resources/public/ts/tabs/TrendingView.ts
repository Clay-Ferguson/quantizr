import { dispatch, useAppState } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Span } from "../comp/core/Span";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { TrendingRSInfo } from "../TrendingRSInfo";
import { FeedTab } from "./data/FeedTab";

export class TrendingView extends AppTab<TrendingRSInfo> {

    static loaded: boolean = false;
    static subscribed: boolean = false;
    static inst: TrendingView = null;

    constructor(data: TabIntf) {
        super(data);
        data.inst = TrendingView.inst = this;

        // only create one subscriber method, which will always act on the static instance most recently set.
        if (!TrendingView.subscribed) {
            TrendingView.subscribed = true;

            PubSub.sub(C.PUBSUB_tabChanging, (tabName: string) => {
                // console.log("Tab Changing in TrendingView [id=" + this.getId() + "]: " + tabName);
                if (tabName === TrendingView.inst.data.id) {
                    // only ever do this once, just to save CPU load on server.
                    if (TrendingView.loaded) return;
                    TrendingView.loaded = true;
                    this.refresh();
                }
            });
        }
    }

    refresh = async () => {
        const res = await S.util.rpc<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: null,
            trending: true,
            feed: true,
            getWords: true,
            getTags: true,
            getMentions: true
        });

        dispatch("RenderSearchResults", s => {
            this.data.props.res = res;
            return s;
        });
    }

    preRender(): void {
        const state = useAppState();
        this.attribs.className = this.getClass(state);
        const res = this.data ? this.data.props.res : null;

        if (!res) {
            this.setChildren([new Heading(4, "Generating statistics...", { className: "marginTop" })]);
            return;
        }

        const tagPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "hashtags") && res.topTags && res.topTags.length > 0) {
            tagPanel.addChild(new Heading(4, "Hashtags", { className: "trendingSectionTitle" }));
            res.topTags.forEach((word: string) => {
                tagPanel.addChild(new Span(word, {
                    className: state.mobileMode ? "statsWordMobile" : "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        const mentionPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "mentions") && res.topMentions && res.topMentions.length > 0) {
            mentionPanel.addChild(new Heading(4, "Mentions", { className: "trendingSectionTitle" }));
            res.topMentions.forEach((word: string) => {
                mentionPanel.addChild(new Span(word, {
                    className: state.mobileMode ? "statsWordMobile" : "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        const wordPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "words") && res.topWords && res.topWords.length > 0) {
            wordPanel.addChild(new Heading(4, "Words", { className: "trendingSectionTitle" }));
            res.topWords.forEach((word: string) => {
                wordPanel.addChild(new Span(word, {
                    className: state.mobileMode ? "statsWordMobile" : "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        this.setChildren([
            new Heading(4, "Trending", { className: "trendingTitle" }),
            new Div("Top 100s, listed in order of frequency of use. Click any word...", { className: "marginBottom" }),

            // this should be correct data but we don't need it here.
            // new TextContent(res.stats, null, false),

            tagPanel.hasChildren() ? tagPanel : null,
            mentionPanel && mentionPanel.hasChildren() ? mentionPanel : null,
            wordPanel.hasChildren() ? wordPanel : null
        ]);
    }

    searchWord = (evt: Event) => {
        const word = S.domUtil.getPropFromDom(evt, "word");
        if (!word) return;

        // expand so users can see what's going on with the search string and know they can clear it.
        // If feed tab exists, expand the filter part
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue(word);
        }

        S.nav.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: true
        });
    }
}
