import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { FeedView } from "../tabs/FeedView";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { HelpButton } from "../widget/HelpButton";
import { Span } from "../widget/Span";
import { TextContent } from "../widget/TextContent";
import { SearchContentDlg } from "./SearchContentDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class NodeStatsDlg extends DialogBase {
    constructor(private res: J.GetNodeStatsResponse, public trending: boolean, public feed: boolean, state: AppState) {
        super(trending ? "Trending (Top 100s)" : "Node Stats (Top 100s)", null, false, state);
    }

    renderDlg = (): CompIntf[] => {
        let tagPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topTags && this.res.topTags.length > 0) {
            tagPanel.addChild(new Heading(4, this.trending ? "Hashtags" : "Top Hashtags"));
            this.res.topTags.forEach((word: string) => {
                tagPanel.addChild(new Span(word, {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        let mentionPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topMentions && this.res.topMentions.length > 0) {
            mentionPanel.addChild(new Heading(4, this.trending ? "Mentions" : "Top Mentions"));
            this.res.topMentions.forEach((word: string) => {
                mentionPanel.addChild(new Span(word, {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        let wordPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topWords && this.res.topWords.length > 0) {
            wordPanel.addChild(new Heading(4, this.trending ? "Words" : "Top Words"));
            this.res.topWords.forEach((word: string) => {
                wordPanel.addChild(new Span(word, {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        return [
            this.trending ? null : new TextContent(this.res.stats, null, false),
            tagPanel.hasChildren() ? tagPanel : null,
            mentionPanel && mentionPanel.hasChildren() ? mentionPanel : null,
            wordPanel.hasChildren() ? wordPanel : null,

            new ButtonBar([
                new Button("Ok", () => {
                    this.close();
                }, null, "btn-primary"),
                new HelpButton(() => S.quanta?.config?.help?.nodeStats?.dialog)
            ])
        ];
    }

    searchWord = (evt: Event) => {
        this.close();

        let word = S.util.getPropFromDom(evt, "word");
        if (!word) return;

        if (this.feed) {
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
                feedFilterRootNode: null
            });
        }
        else {
            SearchContentDlg.defaultSearchText = word;
            new SearchContentDlg(this.appState).open();
        }
    }
}
