import { getAs } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { TabHeading } from "../comp/core/TabHeading";
import { Constants as C } from "../Constants";
import { TabBase } from "../intf/TabBase";
import { NodeInfo } from "../JavaIntf";
import { RepliesRSInfo } from "../RepliesRSInfo";
import { S } from "../Singletons";

export class RepliesView<PT extends RepliesRSInfo> extends AppTab<PT, RepliesView<PT>> {

    constructor(data: TabBase<PT, RepliesView<PT>>) {
        super(data);
        data.inst = this;
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const results = this.data?.props?.results;
        if (!results) return false;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get
         * filtered out on the client side for various reasons.
         */
        let rowCount = 0;
        let i = 0;
        const children: Comp[] = [
            this.headingBar = new TabHeading([
                new IconButton("fa-arrow-left", null, {
                    onClick: () => {
                        const ast = getAs();
                        if (ast.repliesViewFromTab === C.TAB_MAIN) {
                            // the jumpToId is the best way to get to a node on the main tab.
                            S.view.jumpToId(ast.repliesViewNodeId);
                        }
                        else {
                            S.tabUtil.selectTab(ast.repliesViewFromTab);
                            setTimeout(() => {
                                const data: TabBase = S.tabUtil.getAppTabData(ast.repliesViewFromTab);
                                data.inst?.scrollToNode(ast.repliesViewNodeId);
                            }, 700);
                        }
                    },
                    title: "Go back..."
                }, "marginRight"),
                new Div(this.data.name, { className: "tabTitle" }),
            ], this.data),
            this.data.props.description ? new Div(this.data.props.description) : null
        ];

        const jumpButton = ast.isAdminUser || !this.data.props.searchType;

        results.forEach(node => {
            const clazzName = ast.threadViewFromNodeId === node.id ? "threadFeedItemTarget" : "threadFeedItem";

            const c = this.renderItem(node, i, rowCount, jumpButton, clazzName, "threadFeedItemHighlight");
            if (c) {
                children.push(c);
            }

            if (node.children) {
                const subComps: Comp[] = [];
                node.children.forEach(child => {
                    const c = this.renderItem(child, i, rowCount, jumpButton, "threadFeedSubItem", "threadFeedItemHighlight");
                    if (c) {
                        subComps.push(c);
                    }
                });
                children.push(new Div(null, null, subComps));
            }
            i++;
            rowCount++;
        });

        this.children = children;
        return true;
    }

    /* overridable (don't use arrow function) */
    renderItem(node: NodeInfo, _i: number, _rowCount: number, jumpButton: boolean, clazz: string, highlightClazz: string): Comp {
        return S.srch.renderSearchResultAsListItem(node, this.data, jumpButton, true, clazz, highlightClazz, null);
    }
}
