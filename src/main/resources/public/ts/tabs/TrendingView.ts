import { dispatch, useAppState } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Span } from "../comp/core/Span";
import { Spinner } from "../comp/core/Spinner";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { TrendingRSInfo } from "../TrendingRSInfo";
import { FeedTab } from "./data/FeedTab";

PubSub.sub(C.PUBSUB_tabChanging, (tabId: string) => {
    if (tabId === C.TAB_TRENDING) {
        // We have this timer to allow the TrendingView to come into existence.
        setTimeout(() => {
            // only ever do this once, just to save CPU load on server.
            if (TrendingView.loaded || !TrendingView.inst) return;
            TrendingView.loaded = true;
            TrendingView.inst.refresh();
        }, 500);
    }
});

export class TrendingView extends AppTab<TrendingRSInfo> {
    static loaded: boolean = false;
    static inst: TrendingView = null;

    constructor(data: TabIntf) {
        super(data);
        data.inst = TrendingView.inst = this;
    }

    refresh = async () => {
        const res = await S.rpcUtil.rpc<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: null,
            trending: true,
            feed: true,
            getWords: true,
            getTags: true,
            getMentions: true,
            signatureVerify: false
        });

        dispatch("RenderSearchResults", s => {
            this.data.props.res = res;
        });
    }

    preRender(): void {
        const ast = useAppState();
        this.attribs.className = this.getClass(ast);
        const res = this.data ? this.data.props.res : null;

        if (!res) {
            this.setChildren([
                new Heading(4, "Generating statistics...", { className: "marginTop" }),
                new Spinner()
            ]);
            return;
        }

        const tagPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "hashtags") && res.topTags && res.topTags.length > 0) {
            tagPanel.addChild(new Heading(4, "Hashtags", { className: "trendingSectionTitle alert alert-primary" }));
            res.topTags.forEach(word => {
                tagPanel.addChild(new Span(word, {
                    className: ast.mobileMode ? "statsWordMobile" : "statsWord",
                    word,
                    onClick: TrendingView.searchWord
                }));
            });
        }

        const mentionPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "mentions") && res.topMentions && res.topMentions.length > 0) {
            mentionPanel.addChild(new Heading(4, "Mentions", { className: "trendingSectionTitle alert alert-primary" }));
            res.topMentions.forEach(word => {
                mentionPanel.addChild(new Span(word, {
                    className: ast.mobileMode ? "statsWordMobile" : "statsWord",
                    word,
                    onClick: TrendingView.searchWord
                }));
            });
        }

        const wordPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "words") && res.topWords && res.topWords.length > 0) {
            wordPanel.addChild(new Heading(4, "Words", { className: "trendingSectionTitle alert alert-primary" }));
            res.topWords.forEach(word => {
                wordPanel.addChild(new Span(word, {
                    className: ast.mobileMode ? "statsWordMobile" : "statsWord",
                    word,
                    onClick: TrendingView.searchWord
                }));
            });
        }

        this.setChildren([
            // WARNING: headingBar has to be a child of the actual scrollable panel for stickyness to work.
            new Div(null, { className: "headingBar" }, [
                new Div("Trending", { className: "tabTitle" })
            ]),
            new Div("Top 100s, listed in order of frequency of use. Click any word...", { className: "marginBottom" }),

            // this should be correct data but we don't need it here.
            // new TextContent(res.stats, null, false),

            tagPanel.hasChildren() ? tagPanel : null,
            mentionPanel && mentionPanel.hasChildren() ? mentionPanel : null,
            wordPanel.hasChildren() ? wordPanel : null
        ]);
    }

    static searchWord = (evt: Event, word: string) => {
        if (!word) {
            word = S.domUtil.getPropFromDom(evt, "word");
        }
        if (!word) return;

        // expand so users can see what's going on with the search string and know they can clear it.
        // If feed tab exists, expand the filter part
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue(word);
        }

        S.nav.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: true,
            name: J.Constant.FEED_PUB
        });
    }
}
