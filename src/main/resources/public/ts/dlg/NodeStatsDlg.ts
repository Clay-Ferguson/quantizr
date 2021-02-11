import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { Heading } from "../widget/Heading";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class NodeStatsDlg extends DialogBase {

    static sentencesExpanded: boolean;
    static helpExpanded: boolean;

    constructor(private res: J.GetNodeStatsResponse, state: AppState) {
        super("Node Stats", null, false, state);
    }

    renderDlg = (): CompIntf[] => {
        let tagHtml = "";
        this.res.topTags.forEach((word: string) => {
            tagHtml += word + " ";
        });

        let mentionHtml = "";
        this.res.topMentions.forEach((word: string) => {
            mentionHtml += word + " ";
        });

        let wordHtml = "";
        this.res.topWords.forEach((word: string) => {
            wordHtml += word + " ";
        });

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
            new TextContent(this.res.stats, null, false),

            // Needs more tuning (todo-0) need to capture the NODE itself
            // and not the individual sentences. Trivially easy to do.
            // sentencePanel,

            tagHtml ? new Heading(3, "Top 200 Tags") : null,
            tagHtml ? new TextContent(tagHtml, "wordStatsArea", false) : null,

            mentionHtml ? new Heading(3, "Top 200 Mentions") : null,
            mentionHtml ? new TextContent(mentionHtml, "wordStatsArea", false) : null,

            wordHtml ? new Heading(3, "Top 200 Words") : null,
            wordHtml ? new TextContent(wordHtml, "wordStatsArea", false) : null,

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
}
