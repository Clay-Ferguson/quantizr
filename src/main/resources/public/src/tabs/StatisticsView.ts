import { getAs } from "../AppContext";
import { Constants as C } from "../Constants";
import { S } from "../Singletons";
import { StatisticsRSInfo } from "../StatisticsRSInfo";
import { AppTab } from "../comp/AppTab";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Span } from "../comp/core/Span";
import { Progress } from "../comp/core/Progress";
import { TabHeading } from "../comp/core/TabHeading";
import { TextContent } from "../comp/core/TextContent";
import { SearchContentDlg } from "../dlg/SearchContentDlg";
import { TabBase } from "../intf/TabBase";
import { Tailwind } from "../Tailwind";

export class StatisticsView extends AppTab<StatisticsRSInfo, StatisticsView> {
    static inst: StatisticsView = null;

    constructor(data: TabBase<StatisticsRSInfo, StatisticsView>) {
        super(data);
        data.inst = StatisticsView.inst = this;
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const res = this.data ? this.data.props.res : null;

        if (!res) {
            this.children = [
                new Heading(6, "Generating statistics...", { className: "marginTop" }),
                new Progress()
            ];
            return true;
        }

        const tagPanel = new Div(null, { className: "trendingWordStatsArea" });

        // todo-2: add back in when votes are implemented
        // if (this.res.topVotes?.length > 0) {
        //     tagPanel.addChild(new Heading(6, "Votes", { className: "trendingSectionTitle "+Tailwind.alertPrimary }));
        //     this.res.topVotes.forEach(word => {
        //         tagPanel.addChild(new Span(word, {
        //             className: ast.mobileMode ? "statsWordMobile" : "statsWord",
        //             [C.WORD_ATTR]: "\"" + word + "\""
        //         }));
        //     });
        // }

        if ((!this.data.props.filter || this.data.props.filter === "hashtags") && res.topTags && res.topTags.length > 0) {
            tagPanel.addChild(new Heading(6, "Hashtags", { className: "trendingSectionTitle " + Tailwind.alertPrimary }));
            res.topTags.forEach(word => {
                tagPanel.addChild(new Span(word, {
                    className: ast.mobileMode ? "statsWordMobile" : "statsWord",
                    [C.WORD_ATTR]: word,
                    onClick: StatisticsView._searchWord
                }));
            });
        }

        const wordPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "words") && res.topWords && res.topWords.length > 0) {
            wordPanel.addChild(new Heading(6, "Words", { className: "trendingSectionTitle " + Tailwind.alertPrimary }));
            res.topWords.forEach(word => {
                wordPanel.addChild(new Span(word, {
                    className: ast.mobileMode ? "statsWordMobile" : "statsWord",
                    [C.WORD_ATTR]: word,
                    onClick: StatisticsView._searchWord
                }));
            });
        }

        const hasTop100s = tagPanel?.hasChildren() || wordPanel?.hasChildren();

        this.children = [
            this.headingBar = new TabHeading([
                new Div("Node Stats", { className: "tabTitle" })
            ], null),
            res.stats ? new TextContent(res.stats, "marginTop", true) : null,
            hasTop100s ? new Div("Top 100s, listed in order of frequency of use. Click any word...", { className: "marginBottom" }) : null,
            tagPanel.hasChildren() ? tagPanel : null,
            wordPanel.hasChildren() ? wordPanel : null
        ];
        return true;
    }

    static _searchWord = (evt: Event, word: string) => {
        if (!word) {
            word = S.domUtil.getPropFromDom(evt, C.WORD_ATTR);
        }
        if (!word) return;
        SearchContentDlg.defaultSearchText = word;
        new SearchContentDlg().open();
    }
}
