import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { HelpButton } from "../comp/core/HelpButton";
import { Span } from "../comp/core/Span";
import { TextContent } from "../comp/TextContent";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { SearchContentDlg } from "./SearchContentDlg";

export class NodeStatsDlg extends DialogBase {
    constructor(private res: J.GetNodeStatsResponse, public trending: boolean, public feed: boolean, state: AppState) {
        super(trending ? "Trending (Top 100s)" : "Node Stats (Top 100s)", null, false, state);
    }

    renderDlg = (): CompIntf[] => {
        let tagPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topTags?.length > 0) {
            tagPanel.addChild(new Heading(4, this.trending ? "Hashtags" : "Top Hashtags"));
            this.res.topTags.forEach((word: string) => {
                tagPanel.addChild(new Span(word.substring(1), {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        let mentionPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topMentions?.length > 0) {
            mentionPanel.addChild(new Heading(4, this.trending ? "Mentions" : "Top Mentions"));
            this.res.topMentions.forEach((word: string) => {
                mentionPanel.addChild(new Span(word.substring(1), {
                    className: "statsWord",
                    word,
                    onClick: this.searchWord
                }));
            });
        }

        let wordPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topWords?.length > 0) {
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
            ], "marginTop")
        ];
    }

    searchWord = (evt: Event) => {
        this.close();

        let word = S.domUtil.getPropFromDom(evt, "word");
        if (!word) return;

        if (this.feed) {
            let feedData = S.tabUtil.getTabDataById(null, C.TAB_FEED);
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
        else {
            SearchContentDlg.defaultSearchText = word;
            new SearchContentDlg(this.appState).open();
        }
    }
}
