import { AppState } from "../AppState";
import { FeedView } from "../comps/FeedView";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Span } from "../widget/Span";
import { TextContent } from "../widget/TextContent";
import { SearchContentDlg } from "./SearchContentDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class NodeStatsDlg extends DialogBase {

    static helpExpanded: boolean;

    constructor(private res: J.GetNodeStatsResponse, public trending: boolean, public feed: boolean, state: AppState) {
        super(trending ? "Trending Now" : "Node Statistics", null, false, state);
    }

    renderDlg = (): CompIntf[] => {
        let tagPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topTags && this.res.topTags.length > 0) {
            tagPanel.addChild(new Heading(4, this.trending ? "Hashtags" : "Top Hashtags"));
            this.res.topTags.forEach((word: string) => {
                tagPanel.addChild(new Span(word, {
                    className: "statsWord",
                    onClick: () => this.searchWord(word)
                }));
            });
        }

        // todo-0: I'm disabling this for now, because I saw it show suspicously few results on the Fediverse tab
        // and I don't have time to troubleshoot this now, so I'd rather hide it than not know if it's correct or not (for now)
        let mentionPanel = null;
        // mentionPanel new Div(null, { className: "wordStatsArea" });
        // if (this.res.topMentions && this.res.topMentions.length > 0) {
        //     mentionPanel.addChild(new Heading(4, this.trending ? "Mentions" : "Top Mentions"));
        //     this.res.topMentions.forEach((word: string) => {
        //         mentionPanel.addChild(new Span(word, {
        //             className: "statsWord",
        //             onClick: () => this.searchWord(word)
        //         }));
        //     });
        // }

        let wordPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topWords && this.res.topWords.length > 0) {
            wordPanel.addChild(new Heading(4, this.trending ? "Words" : "Top Words"));
            this.res.topWords.forEach((word: string) => {
                wordPanel.addChild(new Span(word, {
                    className: "statsWord",
                    onClick: () => this.searchWord(word)
                }));
            });
        }

        return [
            this.trending ? null : new TextContent(this.res.stats, null, false),
            tagPanel.childrenExist() ? tagPanel : null,
            mentionPanel && mentionPanel.childrenExist() ? mentionPanel : null,
            wordPanel.childrenExist() ? wordPanel : null,

            new CollapsibleHelpPanel("Help: About Node Stats", S.meta64.config.help.nodeStats.dialog,
                (state: boolean) => {
                    NodeStatsDlg.helpExpanded = state;
                }, NodeStatsDlg.helpExpanded),

            new ButtonBar([
                new Button("Ok", () => {
                    this.close();
                }, null, "btn-primary")
            ])
        ];
    }

    searchWord = (word: string) => {
        this.close();

        if (this.feed) {
            /* put word in quotes to do an exact match */
            FeedView.searchTextState.setValue(word);
            FeedView.refresh();
        }
        else {
            SearchContentDlg.defaultSearchText = word;
            new SearchContentDlg(this.appState).open();
        }
    }
}
