import { dispatch, getAs } from "../AppContext";
import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { ResultSetInfo } from "../ResultSetInfo";
import { S } from "../Singletons";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { TabHeading } from "../comp/core/TabHeading";
import { TabBase } from "../intf/TabBase";

/* This class does client-side paging so that we don't overload React renderer with too many items.
which can render too slow, so we max out at only 100 items per page. */
export abstract class DocumentView<PT extends ResultSetInfo> extends AppTab<PT> {
    allowTopMoreButton: boolean = true;
    allowHeader: boolean = true;
    showContentHeading: boolean = true;
    pagingContainerClass: string = "-float-right mb-3 mt-3";

    constructor(data: TabBase<PT>) {
        super(data);
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const results = this.data?.props?.results;
        if (!results) {
            this.children = [new Div("Nothing found.")];
            return true;
        }

        const children: Comp[] = [
            this.headingBar = new TabHeading([
                (ast.searchViewFromTab || this.data.props.node)
                    ? new Button("", () => {
                        if (this.data.props.node) {
                            S.view.jumpToId(this.data.props.node.id);
                        }
                        else if (ast.searchViewFromTab) {
                            S.tabUtil.selectTab(ast.searchViewFromTab);
                            setTimeout(() => {
                                const data: TabBase = S.tabUtil.getAppTabData(ast.searchViewFromTab);
                                if (ast.searchViewFromNode && data.inst) {
                                    data.inst.scrollToNode(ast.searchViewFromNode.id);
                                }
                            }, 500);
                        }
                    }, {
                        title: "Back to Folders View"
                    }, "mr-3", "fa-arrow-left") : null,
                // include back button if we have a central node this panel is about.
                this.renderHeading(),
                this.data.props.description ? new Span(this.data.props.description, { className: "float-right mt-2" }) : null,
                this.getFloatRightHeaderComp(),
                new Clearfix()
            ], this.data),
        ];

        let i = 0;
        let rowCount = 0;
        const startIdx = this.data.props.page * J.ConstantInt.DOC_ITEMS_PER_PAGE;
        const rows: Comp[] = [];
        this.addPaginationBar(rows);
        results.forEach(node => {
            if (rowCount >= J.ConstantInt.DOC_ITEMS_PER_PAGE) return;
            if (i >= startIdx) {
                if (ast.cutCopyOp === "cut" && ast.nodesToMove && ast.nodesToMove.find(n => n === node.id)) return;
                const c = this.renderItem(node, i, rowCount, true);
                if (c) {
                    this.configDragAndDrop(c, ast, node.id);
                    rows.push(c);
                    rowCount++;
                }
            }
            i++;
        });
        this.addPaginationBar(rows);

        children.push(new Div(null, { className: ast.userPrefs.editMode ? "appTabPaneEditMode" : null }, rows));
        this.children = children;
        return true;
    }

    configDragAndDrop(c: Comp, ast: AppState, id: string) {
        if (ast.userPrefs.editMode && !ast.editNode) {
            S.domUtil.setNodeDragHandler(c.attribs, id);
            S.domUtil.makeDropTarget(c.attribs, id);
        }
    }

    /* overridable (don't use arrow function) */
    renderHeading(): Comp {
        return new Div(this.data.name, { className: "tabTitle" });
    }

    /* overridable (don't use arrow function) */
    // Note: It's important to have 'this.data.id' as a classname on every item, even though it's
    // not for styling, it's essentially to support DOM finding.
    renderItem(_node: NodeInfo, _i: number, _rowCount: number, _jumpButton: boolean): Comp {
        console.error("renderItem not overridden from DocumentView base class.");
        return null;
    }

    addPaginationBar(children: Comp[]) {
        const buttonBarComps: Comp[] = [];
        const results = this.data?.props?.results;
        let maxPage = Math.floor(results.length / J.ConstantInt.DOC_ITEMS_PER_PAGE);
        if (results.length % J.ConstantInt.DOC_ITEMS_PER_PAGE > .9) {
            maxPage++;
        }

        if (this.data.props.page >= 1) {
            buttonBarComps.push(new Button(null, () => {
                this.data.props.page = 0;
                this.data.scrollPos = 0;
                dispatch("pageChange", _s => { });
            }, null, null, "fa-angle-double-up fa-lg"));
        }

        if (this.data.props.page > 0) {
            buttonBarComps.push(new Button(null, () => {
                this.data.props.page--;
                this.data.scrollPos = 0;
                dispatch("pageChange", _s => { });
            }, null, null, "fa-angle-up fa-lg"));
        }

        if (this.data.props.page + 1 < maxPage) {
            buttonBarComps.push(new Button(null, () => {
                this.data.props.page = maxPage - 1;
                this.data.scrollPos = 0;
                dispatch("pageChange", _s => { });
            }, null, null, "fa-angle-double-down fa-lg"));
        }

        if (this.data.props.page + 1 < maxPage) {
            buttonBarComps.push(new Button(null, () => {
                this.data.props.page++;
                this.data.scrollPos = 0;
                dispatch("pageChange", _s => { });
            }, null, null, "fa-angle-down fa-lg"));
        }

        children.push(
            new Div(null, { className: this.pagingContainerClass }, [
                new ButtonBar(buttonBarComps),
                new Span("Pg. " + (this.data.props.page + 1) + "/" + maxPage, { className: "ml-3" })
            ]));
    }

    // not used (document handing is special, see above)
    pageChange(_delta: number): void { }
    abstract extraPagingComps(): Comp[];
    abstract getFloatRightHeaderComp(): Comp;
}
