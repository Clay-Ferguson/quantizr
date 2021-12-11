import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { CompIntf } from "../comp/base/CompIntf";
import { ButtonBar } from "../comp/ButtonBar";
import { Div } from "../comp/Div";
import { Heading } from "../comp/Heading";
import { IconButton } from "../comp/IconButton";
import { Span } from "../comp/Span";
import { TextContent } from "../comp/TextContent";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export abstract class ResultSetView extends AppTab {

    allowHeader: boolean = true;
    allowFooter: boolean = true;

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let results = this.data && this.data.rsInfo.results;
        this.attribs.className = this.getClass(state);
        if (!results) return;

        let childCount = results.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let children: CompIntf[] = [];

        let content = null;
        if (this.data.rsInfo.prop !== "node.id" && //
            this.data.rsInfo.prop !== "node.name") {
            content = this.data.rsInfo.node ? S.nodeUtil.getShortContent(this.data.rsInfo.node) : null;
        }

        children.push(new Div(null, null, [
            new Div(null, { className: "marginBottom marginTop" }, [
                this.renderHeading(state),
                this.data.rsInfo.node ? new Span(null, { className: "float-end" }, [
                    new IconButton("fa-arrow-left", "Back", {
                        onClick: () => S.view.jumpToId(this.data.rsInfo.node.id),
                        title: "Back to Node"
                    })
                ]) : null
            ]),
            content ? new TextContent(content, "resultsContentHeading alert alert-secondary") : null,
            this.data.rsInfo.description ? new Div(this.data.rsInfo.description) : null
        ]));

        // this shows the page number. not needed. used for debugging.
        // children.push(new Div("" + data.rsInfo.page + " endReached=" + data.rsInfo.endReached));
        this.addPaginationBar(state, children);

        let i = 0;
        let jumpButton = state.isAdminUser || !this.data.rsInfo.searchType;
        results.forEach((node: J.NodeInfo) => {
            S.srch.initSearchNode(node);
            let c = this.renderItem(node, i, childCount, rowCount, jumpButton, state);
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
    renderItem(node: J.NodeInfo, i: number, childCount: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {
        return S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, this.data.id, false, false, true, jumpButton, this.allowHeader, this.allowFooter, state);
    }

    addPaginationBar = (state: AppState, children: CompIntf[]): void => {
        children.push(
            new Span("Pg. " + (this.data.rsInfo.page + 1), { className: "float-end" }),
            new ButtonBar([
                new IconButton("fa-refresh", null, {
                    onClick: () => this.pageChange(null),
                    title: "Refresh"
                }),
                this.data.rsInfo.page > 1 ? new IconButton("fa-angle-double-left", null, {
                    onClick: () => this.pageChange(0),
                    title: "First Page"
                }) : null,
                this.data.rsInfo.page > 0 ? new IconButton("fa-angle-left", null, {
                    onClick: () => this.pageChange(-1),
                    title: "Previous Page"
                }) : null,
                !this.data.rsInfo.endReached ? new IconButton("fa-angle-right", "More", {
                    onClick: () => this.pageChange(1),
                    title: "Next Page"
                }) : null
            ], "text-center marginBottom marginTop"));
    }

    abstract pageChange(delta: number): void;
}
