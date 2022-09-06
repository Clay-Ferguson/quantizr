import { getAppState, useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ThreadRSInfo } from "../ThreadRSInfo";

export class ThreadView<T extends ThreadRSInfo> extends AppTab<T> {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
    }

    preRender(): void {
        const state = useAppState();
        const results = this.data?.props?.results;
        this.attribs.className = this.getClass(state);
        if (!results) return;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let i = 0;
        const children: CompIntf[] = [S.render.makeWidthSizerPanel()];

        children.push(new Div(null, null, [
            new Div(null, { className: "marginBottom marginTop" }, [
                new Div(this.data.name + " / Hierarchy", { className: "tabTitle" }),
                new Div(this.data.props.endReached ? "Chain of replies going back to original post" //
                    : "Chain of replies going back towards original post", { className: "float-end" }),
                new Clearfix(),
                !this.data.props.endReached ? new Button("Load More...", () => { this.moreHistory() },
                    { className: "float-end" }, "btn-primary") : null,
                new Clearfix()
            ]),
            this.data.props.description ? new Div(this.data.props.description) : null
        ]));

        const jumpButton = state.isAdminUser || !this.data.props.searchType;

        // NOTE: The current findNode() impl for this tab doesn't take into account the 'data.props.others' yet. probably should.
        const others: J.NodeInfo[] = this.data.props.others;

        results.forEach((node: J.NodeInfo) => {
            const c = this.renderItem(node, i, rowCount, jumpButton, state);
            if (c) {
                children.push(c);
            }
            i++;
            rowCount++;
            if (i === results.length - 1) {
                children.push(new Heading(4, "Replies to the Above...", { className: "marginTop" }));
            }
        });

        if (others) {
            others.forEach((node: J.NodeInfo) => {
                const c = this.renderItem(node, i, rowCount, jumpButton, state);
                if (c) {
                    children.push(c);
                }
                i++;
                rowCount++;
            });
        }

        this.setChildren(children);
    }

    moreHistory = () => {
        const state = getAppState();
        const results = this.data && this.data.props.results;
        if (!results || results.length === 0) return;
        S.srch.showThreadAddMore(results[0].id, state);
    }

    /* overridable (don't use arrow function) */
    renderItem(node: J.NodeInfo, i: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {
        return S.srch.renderSearchResultAsListItem(node, this.data, i, rowCount, this.data.id, false, false,
            true, jumpButton, true, true, false, "userFeedItem", "userFeedItemHighlight", null, state);
    }
}
