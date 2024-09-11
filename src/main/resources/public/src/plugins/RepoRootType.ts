import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabBase } from "../intf/TabBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class RepoRootType extends TypeBase {
    constructor() {
        super(J.NodeType.REPO_ROOT, "Root", "fa-home", false);
    }

    override allowPropertyEdit(_propName: string): boolean {
        return true;
    }

    override render = (_node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Root", { className: "noMargin" })
        ]);
    }
}
