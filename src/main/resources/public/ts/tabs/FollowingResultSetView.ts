import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Heading } from "../comp/core/Heading";
import { FollowingRSInfo } from "../FollowingRSInfo";
import { TabDataIntf } from "../intf/TabDataIntf";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class FollowingResultSetView<I extends FollowingRSInfo> extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        this.allowHeader = false;
        this.allowFooter = false;
        data.inst = this;
    }

    pageChange(delta: number): void {
        let info = this.data.rsInfo as FollowingRSInfo;
        let page = info.page;

        // Yes the check against null IS required. Don't change.
        if (delta !== null) {
            page = delta === 0 ? 0 : info.page + delta;
        }
        S.srch.showFollowing(page, info.showingFollowingOfUser);
    }

    renderHeading(state: AppState): CompIntf {
        let info = this.data.rsInfo as FollowingRSInfo;
        return new Heading(4, "@" + info.showingFollowingOfUser + " is Following...", { className: "resultsTitle" });
    }
}
