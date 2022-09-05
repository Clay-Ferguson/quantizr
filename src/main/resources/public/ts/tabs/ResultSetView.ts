import { useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { CompIntf } from "../comp/base/CompIntf";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { IconButton } from "../comp/core/IconButton";
import { Span } from "../comp/core/Span";
import { TextContent } from "../comp/core/TextContent";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { ResultSetInfo } from "../ResultSetInfo";
import { S } from "../Singletons";
import { Constants as C } from "../Constants";

export abstract class ResultSetView<T extends ResultSetInfo> extends AppTab<T> {

    allowHeader: boolean = true;
    allowFooter: boolean = true;
    showContentHeading: boolean = true;

    constructor(data: TabIntf, private showRoot: boolean = true, private showPageNumber: boolean = true, private infiniteScrolling = false) {
        super(data);
        if (infiniteScrolling && showPageNumber) {
            throw new Error("page numbering incompatable with infinite scrolling")
        }
    }

    preRender(): void {
        const state = useAppState();
        const results = this.data && this.data.props.results;
        this.attribs.className = this.getClass(state);
        if (!results) return;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        const children: CompIntf[] = [S.render.makeWidthSizerPanel()];

        let content = null;
        if (this.showContentHeading && //
            this.data.props.prop !== "node.id" && //
            this.data.props.prop !== "node.name") {
            content = this.data.props.node ? S.nodeUtil.getShortContent(this.data.props.node) : null;
        }

        children.push(new Div(null, null, [
            new Div(null, { className: "marginBottom marginTop" }, [
                // include back button if we have a central node this panel is about.
                this.data.props.node && this.showContentHeading
                    ? new IconButton("fa-arrow-left", "", {
                        onClick: () => S.view.jumpToId(this.data.props.node.id),
                        title: "Back to Node Tree view"
                    }, "marginRight") : null,
                this.renderHeading(state)
            ]),
            this.showRoot && content ? new TextContent(content, "resultsContentHeading alert alert-secondary") : null,
            this.data.props.description ? new Div(this.data.props.description) : null
        ]));

        // this shows the page number. not needed. used for debugging.
        // children.push(new Div("" + data.rsInfo.page + " endReached=" + data.rsInfo.endReached));
        this.addPaginationBar(state, children);

        let i = 0;
        const jumpButton = state.isAdminUser || !this.data.props.searchType;

        results.forEach((node: J.NodeInfo) => {
            const c = this.renderItem(node, i, rowCount, jumpButton, state);
            if (c) {
                children.push(c);
            }
            i++;
            rowCount++;
        });

        this.addPaginationBar(state, children);
        this.setChildren(children);
    }

    /* overridable (don't use arrow function) */
    renderHeading(state: AppState): CompIntf {
        return new Heading(4, this.data.name, { className: "resultsTitle" });
    }

    /* overridable (don't use arrow function) */
    // Note: It's important to have 'this.data.id' as a classname on every item, even though it's not for styling,
    // it's essentially to support DOM finding.
    renderItem(node: J.NodeInfo, i: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {
        return S.srch.renderSearchResultAsListItem(node, this.data, i, rowCount, this.data.id, false, false, true,
            jumpButton, this.allowHeader, this.allowFooter, true, "userFeedItem " + this.data.id,
            "userFeedItemHighlight " + this.data.id, state);
    }

    addPaginationBar = (state: AppState, children: CompIntf[]) => {

        const extraPagingDiv = this.extraPagingDiv();
        if (extraPagingDiv) {
            children.push(extraPagingDiv);
        }

        let moreButton: IconButton = null;
        if (!this.data.props.endReached) {
            moreButton = new IconButton("fa-angle-right", "More", {
                onClick: () => this.pageChange(1),
                title: "Next Page"
            })

            if (this.infiniteScrolling && C.FEED_INFINITE_SCROLL) {
                const buttonCreateTime: number = new Date().getTime();
                // When the 'more' button scrolls into view go ahead and load more records.
                moreButton.onMount((elm: HTMLElement) => {
                    const observer = new IntersectionObserver(entries => {
                        entries.forEach((entry: any) => {
                            if (entry.isIntersecting) {
                                // if this button comes into visibility within 2 seconds of it being created
                                // that means it was rendered visible without user scrolling so in this case
                                // we want to disallow the auto loading
                                if (new Date().getTime() - buttonCreateTime < 2000) {
                                    observer.disconnect();
                                }
                                else {
                                    moreButton.replaceWithWaitIcon()
                                    // console.log("Loading more...");
                                    this.pageChange(1);
                                }
                            }
                        });
                    });
                    observer.observe(elm);
                });
            }
        }

        children.push(
            this.showPageNumber ? new Span("Pg. " + (this.data.props.page + 1), { className: "float-end" }) : null,
            new ButtonBar([
                new IconButton("fa-refresh", null, {
                    onClick: () => this.pageChange(null),
                    title: "Refresh Search"
                }),
                this.data.props.page > 1 ? new IconButton("fa-angle-double-left", null, {
                    onClick: () => this.pageChange(0),
                    title: "First Page"
                }) : null,
                this.data.props.page > 0 ? new IconButton("fa-angle-left", null, {
                    onClick: () => this.pageChange(-1),
                    title: "Previous Page"
                }) : null,
                moreButton
            ], "text-center marginBottom marginTop"));
    }

    abstract pageChange(delta: number): void;

    abstract extraPagingDiv(): Div;
}
