import { AppState } from "../AppState";
import { FeedView } from "../comps/FeedView";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
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

    static sentencesExpanded: boolean;
    static helpExpanded: boolean;

    constructor(private res: J.GetNodeStatsResponse, public trending: boolean, public feed: boolean, state: AppState) {
        super(trending ? "Trending Now" : "Node Stats", null, false, state);
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

        let mentionPanel = new Div(null, { className: "wordStatsArea" });
        if (this.res.topMentions && this.res.topMentions.length > 0) {
            mentionPanel.addChild(new Heading(4, this.trending ? "Mentions" : "Top Mentions"));
            this.res.topMentions.forEach((word: string) => {
                mentionPanel.addChild(new Span(word, {
                    className: "statsWord",
                    onClick: () => this.searchWord(word)
                }));
            });
        }

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

        let sentences: Comp[] = [];
        this.res.topSentences.forEach((sentence: string) => {
            sentences.push(new TextContent(sentence));
        });

        let sentencePanel = null;
        if (sentences.length > 0) {
            sentencePanel = new CollapsiblePanel("Show Top Sentences", "Hide Top Sentences", null, [
                new Heading(3, "Top 10 Sentences (by word frequency analysis)"),
                ...sentences
            ], false,
                (state: boolean) => {
                    NodeStatsDlg.sentencesExpanded = state;
                }, NodeStatsDlg.sentencesExpanded, "", "", "div");
        }

        return [
            this.trending ? null : new TextContent(this.res.stats, null, false),

            // Needs more tuning (todo-0) need to capture the NODE content itself
            // and not the individual sentences in nodes. This is trivially easy to do,
            // with a small server side tweak.
            // sentencePanel,

            tagPanel.childrenExist() ? tagPanel : null,
            mentionPanel.childrenExist() ? mentionPanel : null,
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
            FeedView.searchTextState.setValue(word);
            FeedView.refresh();
        }
        else {
            SearchContentDlg.defaultSearchText = word;
            new SearchContentDlg(this.appState).open();
        }
    }
}
