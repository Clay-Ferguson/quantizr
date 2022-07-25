import { store, useAppState } from "../AppRedux";
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

export class ThreadView<I extends ThreadRSInfo> extends AppTab {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
    }

    preRender(): void {
        let state = useAppState();
        let results = this.data?.rsInfo?.results;
        this.attribs.className = this.getClass(state);
        if (!results) return;
        let childCount = results.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let i = 0;
        let children: CompIntf[] = [];

        children.push(new Div(null, null, [
            new Div(null, { className: "marginBottom marginTop" }, [
                new Heading(4, this.data.name + " / Hierarchy", { className: "resultsTitle" }),
                new Div(this.data.rsInfo.endReached ? "Chain of replies going back to original post" //
                : "Chain of replies going back towards original post", { className: "float-end" }),
                new Clearfix(),
                !this.data.rsInfo.endReached ? new Button("Load More...", () => { this.moreHistory() }, { className: "float-end" }) : null,
                new Clearfix()
            ]),
            this.data.rsInfo.description ? new Div(this.data.rsInfo.description) : null
        ]));

        let jumpButton = state.isAdminUser || !this.data.rsInfo.searchType;
        let others: J.NodeInfo[] = this.data.props.others;

        results.forEach((node: J.NodeInfo) => {
            S.srch.initSearchNode(node);
            let c = this.renderItem(node, i, rowCount, jumpButton, state);
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
                S.srch.initSearchNode(node);
                let c = this.renderItem(node, i, rowCount, jumpButton, state);
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
        let state = store.getState();
        let results = this.data && this.data.rsInfo.results;
        if (!results || results.length === 0) return;
        S.srch.showThreadAddMore(results[0].id, state);
    }

    /* overridable (don't use arrow function) */
    renderItem(node: J.NodeInfo, i: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {
        return S.srch.renderSearchResultAsListItem(node, this.data, i, rowCount, this.data.id, false, false, true, jumpButton, true, true, false, state);
    }
}
