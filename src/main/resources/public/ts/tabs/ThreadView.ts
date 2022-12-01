import { getAppState, useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
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
        const ast = useAppState();
        const results = this.data?.props?.results;
        if (!results) return;
        this.attribs.className = this.getClass(ast);

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let i = 0;
        const children: CompIntf[] = [S.render.makeWidthSizerPanel()];

        children.push(new Div(null, null, [
            new Div(null, { className: "headingBar" }, [
                new Div(this.data.name + " / Hierarchy", { className: "tabTitle" }),
                !this.data.props.endReached ? new Div("More of this thread can be displayed", { className: "float-end" }) : null,
                new Clearfix(),
                !this.data.props.endReached ? new Button("Load More...", () => { this.moreHistory() },
                    { className: "float-end tinyMarginBottom" }, "btn-primary") : null,
                new Clearfix()
            ]),
            this.data.props.description ? new Div(this.data.props.description) : null
        ]));

        const jumpButton = ast.isAdminUser || !this.data.props.searchType;

        results.forEach(node => {
            const c = this.renderItem(node, i, rowCount, jumpButton, "threadFeedItem", ast);
            if (c) {
                children.push(c);
            }

            if (node.children) {
                const subComps: CompIntf[] = [];
                node.children.forEach(child => {
                    const c = this.renderItem(child, i, rowCount, jumpButton, "threadFeedSubItem", ast);
                    if (c) {
                        subComps.push(c);
                    }
                });
                children.push(new Div(null, null, subComps));
            }

            i++;
            rowCount++;
        });

        this.setChildren(children);
    }

    moreHistory = () => {
        const ast = getAppState();
        const results = this.data?.props?.results;
        if (!results || results.length === 0) return;
        S.srch.showThreadAddMore(results[0].id, ast);
    }

    /* overridable (don't use arrow function) */
    renderItem(node: J.NodeInfo, i: number, rowCount: number, jumpButton: boolean, clazz: string, ast: AppState): CompIntf {
        return S.srch.renderSearchResultAsListItem(node, this.data, i, rowCount, false,
            true, jumpButton, true, true, false, clazz, "threadFeedItemHighlight", null, ast);
    }
}
