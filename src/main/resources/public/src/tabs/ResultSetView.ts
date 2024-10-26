import { getAs } from "../AppContext";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { TabHeading } from "../comp/core/TabHeading";
import { TextContent } from "../comp/core/TextContent";
import { Constants as C } from "../Constants";
import { TabBase } from "../intf/TabBase";
import { NodeInfo } from "../JavaIntf";
import { ResultSetInfo } from "../ResultSetInfo";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";

export abstract class ResultSetView<PT extends ResultSetInfo, TT extends AppTab> extends AppTab<PT, TT> {

    allowTopMoreButton: boolean = true;
    allowHeader: boolean = true;
    showContentHeading: boolean = true;
    pagingContainerClass: string = "marginBottom mt-3";

    constructor(data: TabBase<PT, TT>, private showRoot: boolean = true, private showPageNumber: boolean = true, private infiniteScrolling = false) {
        super(data);
        if (infiniteScrolling && showPageNumber) {
            throw new Error("page numbering incompatable with infinite scrolling")
        }
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const results = this.data?.props?.results;
        if (!results) {
            this.children = [new Div("Nothing found.")];
            return true;
        }

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get
         * filtered out on the client side for various reasons.
         */
        let rowCount = 0;

        let content = null;
        if (this.showContentHeading && //
            this.data.props.prop !== "node.id" && //
            this.data.props.prop !== "node.name") {
            content = this.data.props.node ? S.nodeUtil.getShortContent(this.data.props.node) : null;
        }

        const children: Comp[] = [
            this.headingBar = new TabHeading([
                (ast.searchViewFromTab || this.data.props.node) && this.showContentHeading
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
                this.data.props.description ? new Span(this.data.props.description, { className: "tw-float-right smallMarginTop" }) : null,
                this.getFloatRightHeaderComp(),
                new Clearfix()
            ], this.data),
            this.showRoot && content ? new TextContent(content, "resultsContentHeading " + Tailwind.alertSecondary) : null,
            // !ast.mobileMode && this.data?.props?.breadcrumbs ? new BreadcrumbsPanel(this.data?.props?.breadcrumbs) : null
        ];

        // this shows the page number. not needed. used for debugging.
        // children.push(new Div("" + data.rsInfo.page + " endReached=" + data.rsInfo.endReached));
        this.addPaginationBar(children, false, this.allowTopMoreButton, true);

        if (this.data.id === C.TAB_TIMELINE && ast.timelineReversedOrder) {
            for (let i = results.length - 1; i >= 0; i--) {
                const node = results[i];
                if (ast.cutCopyOp === "cut" && ast.nodesToMove && ast.nodesToMove.find(n => n === node.id)) return;
                const c = this.renderItem(node, i, rowCount, true);
                if (c) {
                    this.configDragAndDrop(c, ast, node.id);
                    children.push(c);
                }
                rowCount++;
            }
        }
        else {
            let i = 0;
            results.forEach(node => {
                if (ast.cutCopyOp === "cut" && ast.nodesToMove && ast.nodesToMove.find(n => n === node.id)) return;
                const c = this.renderItem(node, i, rowCount, true);
                if (c) {
                    this.configDragAndDrop(c, ast, node.id);
                    children.push(c);
                }
                i++;
                rowCount++;
            });
        }
        this.addPaginationBar(children, true, true, false);
        this.children = children;
        return true;
    }

    configDragAndDrop(c: Comp, ast: AppState, id: string) {
        if (!ast.mobileMode && ast.userPrefs.editMode && !ast.editNode) {
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
    renderItem(node: NodeInfo, _i: number, _rowCount: number, jumpButton: boolean): Comp {
        const ast = getAs();
        const allowHeader = this.allowHeader && (S.util.showMetaData(ast, node) || ast.userPrefs.editMode);
        return S.srch.renderSearchResultAsListItem(node, this.data, jumpButton, allowHeader, "userFeedItem",
            "userFeedItemHighlight", null);
    }

    addPaginationBar(children: Comp[], allowInfiniteScroll: boolean, allowMoreButton: boolean, isTopBar: boolean) {
        let moreButton: Button = null;
        if (this.data.id === C.TAB_TIMELINE) {
            this.showPageNumber = false;
        }

        const reverse = this.data.id === C.TAB_TIMELINE && getAs().timelineReversedOrder;
        const rightArrow = reverse ? "up" : "down";
        const leftArrow = reverse ? "down" : "up";

        if (!this.data.props.endReached && allowMoreButton) {
            moreButton = new Button(null, () => this.pageChange(1), null, null, "fa-angle-" + rightArrow + " fa-lg")

            if (allowInfiniteScroll && this.infiniteScrolling && C.FEED_INFINITE_SCROLL) {
                const buttonCreateTime: number = new Date().getTime();
                // When the 'more' button scrolls into view go ahead and load more records.
                moreButton.onMount((elm: HTMLElement) => {
                    const observer = new IntersectionObserver(entries => {
                        entries.forEach((entry: IntersectionObserverEntry) => {
                            if (entry.isIntersecting) {
                                // if this button comes into visibility within 2 seconds of it being
                                // created that means it was rendered visible without user scrolling
                                // so in this case we want to disallow the auto loading
                                if (new Date().getTime() - buttonCreateTime < 2000) {
                                    observer.disconnect();
                                }
                                else {
                                    moreButton.replaceWithWaitIcon()
                                    this.pageChange(1);
                                }
                            }
                        });
                    });
                    observer.observe(elm);
                });
            }
        }

        const extraPagingComps = isTopBar ? this.extraPagingComps() : null;

        let buttonBarComps: Comp[] = [];
        if (isTopBar) {
            buttonBarComps.push(new Button(null, () => this.pageChange(null), null, null, "fa-refresh"));
        }

        if (this.data.props.page >= 1) {
            buttonBarComps.push(new Button(null, () => this.pageChange(0), null, null, "fa-angle-double-" + leftArrow + " fa-lg"));
        }

        if (this.data.props.page > 0) {
            buttonBarComps.push(new Button(null, () => this.pageChange(-1), null, null, "fa-angle-" + leftArrow + " fa-lg"));
        }
        buttonBarComps.push(moreButton);

        if (extraPagingComps) {
            buttonBarComps = buttonBarComps.concat(extraPagingComps);
        }

        if (this.data.props.endReached && !isTopBar && this.showPageNumber) {
            buttonBarComps.push(new Span("*** Last Page ***", { className: "bigMarginLeft" }));
        }

        children.push(
            this.showPageNumber ? new Span("Pg. " + (this.data.props.page + 1), { className: "tw-float-right" }) : null,
            new ButtonBar(buttonBarComps, this.pagingContainerClass));

        children.push(new Clearfix());
    }

    abstract pageChange(delta: number): void;
    abstract extraPagingComps(): Comp[];
    abstract getFloatRightHeaderComp(): Comp;
}
