import { getAppState } from "../AppContext";
import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Icon } from "../comp/core/Icon";
import { DocumentRSInfo } from "../DocumentRSInfo";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class DocumentResultSetView<T extends DocumentRSInfo> extends ResultSetView<T> {

    constructor(data: TabIntf) {
        super(data, false, false, true);
        data.inst = this;
    }

    renderItem(node: J.NodeInfo, i: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {

        // Our header base in this scenario has the edit controls intermingled with the rest, so for now if either
        // of these user prefs is active we show the header bar.
        const allowHeader = state.userPrefs.showMetaData || state.userPrefs.editMode;

        const itemClass = allowHeader ? "userFeedItem" : null;
        const itemClassHighlight = allowHeader ? "userFeedItemHighlight" : null;

        const row = S.srch.renderSearchResultAsListItem(node, this.data, i, rowCount, this.data.id, false, false,
            true, jumpButton, allowHeader, this.allowFooter, true, itemClass, itemClassHighlight, state);

        if (S.props.getClientProp(J.NodeProp.TRUNCATED, node)) {
            // todo-1: We could easily make this icon clickable to render this node as the root of a new document
            // but then we'd need to have a "back button" capability to get back to previous document render.
            row.addChild(new Icon({
                className: "fa fa-warning float-end warningIcon",
                title: "Nodes truncated. Tree too Deep."
            }));
            row.addChild(new Clearfix());
        }
        return row;
    }

    pageChange(delta: number): void {
        setTimeout(() => {
            const growPage = delta !== null && delta > 0;
            S.srch.showDocument(this.data.props.node, growPage, getAppState());
        }, 500);
    }

    extraPagingDiv = (): Div => {
        return new Div(null, { className: "float-end" }, [
            new Icon({
                className: "fa fa-search fa-lg buttonBarIcon",
                title: "Search Subnodes",
                nid: this.data.props.node.id,
                onClick: S.nav.runSearch
            }),
            new Icon({
                className: "fa fa-clock-o fa-lg buttonBarIcon",
                title: "View Timeline (by Mod Time)",
                nid: this.data.props.node.id,
                onClick: S.nav.runTimeline
            })
        ]);
    }
}
