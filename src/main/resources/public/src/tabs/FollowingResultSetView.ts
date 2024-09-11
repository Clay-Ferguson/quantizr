import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { FollowingRSInfo } from "../FollowingRSInfo";
import { TabBase } from "../intf/TabBase";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class FollowingResultSetView<PT extends FollowingRSInfo> extends ResultSetView<PT, FollowingResultSetView<PT>> {

    constructor(data: TabBase<PT, FollowingResultSetView<PT>>) {
        super(data);
        this.allowHeader = false;
        data.inst = this;
        this.showContentHeading = false;
    }

    override pageChange(delta: number): void {
        let page = this.data.props.page;

        // Yes the check against null IS required. Don't change.
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }
        S.srch.showFollowing(page, this.data.props.showingFollowingOfUser);
    }

    override renderHeading(): Comp {
        return new Div("@" + this.data.props.showingFollowingOfUser + " is Following...", { className: "tabTitle" });
    }

    override extraPagingComps(): Comp[] {
        return null;
    }

    override getFloatRightHeaderComp(): Comp {
        return null;
    }
}
