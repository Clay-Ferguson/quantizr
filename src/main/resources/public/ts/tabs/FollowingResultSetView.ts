import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { FollowingRSInfo } from "../FollowingRSInfo";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class FollowingResultSetView<T extends FollowingRSInfo> extends ResultSetView<T> {

    constructor(data: TabIntf) {
        super(data);
        this.allowHeader = false;
        this.allowFooter = false;
        data.inst = this;
        this.showContentHeading = false;
    }

    pageChange(delta: number): void {
        let page = this.data.props.page;

        // Yes the check against null IS required. Don't change.
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }
        S.srch.showFollowing(page, this.data.props.showingFollowingOfUser);
    }

    renderHeading(state: AppState): CompIntf {
        return new Heading(4, "@" + this.data.props.showingFollowingOfUser + " is Following...", { className: "resultsTitle" });
    }

    extraPagingDiv(): Div {
        return null;
    }
}
