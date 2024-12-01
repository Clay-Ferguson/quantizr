import { dispatch, getAs } from "../AppContext";
import { StatisticsRSInfo } from "../StatisticsRSInfo";
import { Tailwind } from "../Tailwind";
import { AppTab } from "../comp/AppTab";
import { Button } from "../comp/core/Button";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Progress } from "../comp/core/Progress";
import { TabHeading } from "../comp/core/TabHeading";
import { TextContent } from "../comp/core/TextContent";
import { SearchDlg } from "../dlg/SearchDlg";
import { TabBase } from "../intf/TabBase";
import { S } from "../Singletons";

export class StatisticsView extends AppTab<StatisticsRSInfo, StatisticsView> {
    static inst: StatisticsView = null;

    constructor(data: TabBase<StatisticsRSInfo, StatisticsView>) {
        super(data);
        data.inst = StatisticsView.inst = this;
    }

    override preRender(): boolean | null {
        const res = this.data ? this.data.props.res : null;

        if (!res) {
            this.children = [
                new Heading(6, "Generating statistics...", { className: "mt-3" }),
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
            res.topTags.forEach(tag => {
                tagPanel.addChild(new Checkbox(tag, { className: "mr-3" }, {
                    setValue: (checked: boolean) => {
                        const worsSelections = getAs().wordSelections;
                        if (checked) {
                            worsSelections.add(tag);
                        } else {
                            worsSelections.delete(tag);
                        }
                        dispatch("UpdateTagSelections", s => {
                            s.wordSelections = worsSelections;
                        });
                    },
                    getValue: (): boolean => {
                        return getAs().wordSelections.has(tag);
                    }
                }));
            });
        }

        const wordPanel = new Div(null, { className: "trendingWordStatsArea" });
        if ((!this.data.props.filter || this.data.props.filter === "words") && res.topWords && res.topWords.length > 0) {
            wordPanel.addChild(new Heading(6, "Words", { className: "trendingSectionTitle " + Tailwind.alertPrimary }));
            res.topWords.forEach(word => {
                wordPanel.addChild(new Checkbox(word, { className: "mr-3" }, {
                    setValue: (checked: boolean) => {
                        const worsSelections = getAs().wordSelections;
                        if (checked) {
                            worsSelections.add(word);
                        } else {
                            worsSelections.delete(word);
                        }
                        dispatch("UpdateWordSelections", s => {
                            s.wordSelections = worsSelections;
                        });
                    },
                    getValue: (): boolean => {
                        return getAs().wordSelections.has(word);
                    }
                }));
            });
        }
        const hasTop100s = tagPanel?.hasChildren() || wordPanel?.hasChildren();
        this.children = [
            this.headingBar = new TabHeading([
                new Div("Node Info", { className: "tabTitle" })
            ], null),
            res.stats ? new TextContent(res.stats, "my-3", true) : null,
            hasTop100s ? new Div("Top 100 listed in order of frequency", { className: "mb-3" }) : null,
            tagPanel.hasChildren() ? tagPanel : null,
            wordPanel.hasChildren() ? wordPanel : null,
            hasTop100s ? new Button("Search", this._searchSelectedWords, { className: "mt-3" }, "-primary") : null
        ];
        return true;
    }

    _searchSelectedWords = () => {
        let searchText = "";
        getAs().wordSelections.forEach(word => {
            // for correct searching we must quote the terms
            searchText += "\"" + word + "\" ";
        });

        // if no searchText show a warning
        if (!searchText) {
            S.util.showMessage("No words are selected.", "Warning");
            return;
        }

        SearchDlg.defaultSearchText = searchText.trim();
        new SearchDlg().open();
    }
}
