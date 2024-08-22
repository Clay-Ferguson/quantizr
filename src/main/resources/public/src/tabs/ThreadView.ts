import { getAs } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { TabHeading } from "../comp/core/TabHeading";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { ThreadRSInfo } from "../ThreadRSInfo";
import * as J from "../JavaIntf";
import { MessageDlg } from "../dlg/MessageDlg";
import { VerticalLayout } from "../comp/core/VerticalLayout";
import { Anchor } from "../comp/core/Anchor";
import { ExportDlg } from "../dlg/ExportDlg";

export class ThreadView<PT extends ThreadRSInfo> extends AppTab<PT, ThreadView<PT>> {

    constructor(data: TabIntf<PT, ThreadView<PT>>) {
        super(data);
        data.inst = this;
    }

    override preRender = (): boolean => {
        const ast = getAs();
        const results = this.data?.props?.results;
        if (!results) {
            this.children = [new Div("Nothing found.")];
            return true;
        }

        const floatEndDiv = new Div(null, { className: "float-end tinyMarginBottom" }, [
            !this.data.props.endReached ? new Button("More History...", this.moreHistory,
                { className: "float-end tinyMarginBottom" }, "btn-primary") : null,
            new Button("Save as PDF", this.saveAsPDF,
                { className: "float-end tinyMarginBottom" }),
        ]);

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
                        if (ast.threadViewFromTab === C.TAB_MAIN) {
                            // the jumpToId is the best way to get to a node on the main tab.
                            S.view.jumpToId(ast.threadViewFromNodeId);
                        }
                        else {
                            S.tabUtil.selectTab(ast.threadViewFromTab);
                            setTimeout(() => {
                                const data: TabIntf = S.tabUtil.getAppTabData(ast.threadViewFromTab);
                                if (ast.threadViewFromNodeId && data.inst) {
                                    data.inst.scrollToNode(ast.threadViewFromNodeId);
                                }
                            }, 500);
                        }
                    },
                    title: "Go back..."
                }, "marginRight"),
                new Div(this.data.name, { className: "tabTitle" }),
                floatEndDiv,
                new Clearfix()
            ], null),
            this.data.props.description ? new Div(this.data.props.description) : null
        ];

        const jumpButton = ast.isAdminUser || !this.data.props.searchType;
        let lastNode: NodeInfo = null;

        results.forEach(node => {
            const clazzName = ast.repliesViewNodeId === node.id ? "threadFeedItemTarget" : "threadFeedItem";
            const highlightClazzName = ast.repliesViewNodeId === node.id ? "threadFeedItemHighlightTarget" : "threadFeedItemHighlight";

            const c = this.renderItem(node, i, rowCount, jumpButton, clazzName, highlightClazzName);
            if (c) {
                lastNode = node;
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

        if (lastNode?.type == J.NodeType.AI_ANSWER) {
            children.push(new Button("Ask AI", S.edit.askAiFromThreadView, {
                [C.NODE_ID_ATTR]: lastNode.id,
            }, "btn-secondary ui-new-node-plus marginTop", "fa-plus"));
        }

        this.children = children;
        return true;
    }

    moreHistory = () => {
        S.srch.showThread(getAs().threadViewFromNodeId);
    }

    saveAsPDF = async () => {
        const dlg =new ExportDlg("thread-view", getAs().threadViewFromNodeId, true);
        await dlg.open();
        this.exportResponse(dlg.res);
    }

    exportResponse = (res: J.ExportResponse) => {
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but
        eventually the plan is to have the export return the actual md5 of the export for use here
        */
        // disp=inline (is the other)
        const downloadLink = S.util.getHostAndPort() + "/f/export/" + res.fileName + "?disp=attachment&v=" + (new Date().getTime()) + "&token=" + S.quanta.authToken;

        if (S.util.checkSuccess("Export", res)) {
            new MessageDlg(
                "Export successful.<p>Use the download link below now, to get the file.",
                "Export",
                null,
                new VerticalLayout([
                    new Anchor(downloadLink, "Download", { target: "_blank" }),
                ]), false, 0, null
            ).open();
        }
    }

    /* overridable (don't use arrow function) */
    renderItem(node: NodeInfo, _i: number, _rowCount: number, jumpButton: boolean, clazz: string, highlightClazz: string): Comp {
        return S.srch.renderSearchResultAsListItem(node, this.data, jumpButton, true, clazz, highlightClazz, null);
    }
}