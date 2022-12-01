import { getAppState } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { TabIntf } from "../intf/TabIntf";
import { SharesRSInfo } from "../SharesRSInfo";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class SharedNodesResultSetView<T extends SharesRSInfo> extends ResultSetView<T> {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
        this.showContentHeading = false;
    }

    pageChange(delta: number): void {
        const ast = getAppState();

        let page = this.data.props.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }

        S.srch.findSharedNodes(this.data.props.node,
            page,
            this.data.props.shareNodesType,
            this.data.props.shareTarget,
            this.data.props.accessOption,
            ast);
    }

    extraPagingComps = (): Comp[] => {
        return null;
    }
}
