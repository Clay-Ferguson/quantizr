import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { Comp } from "../comp/base/Comp";
import { Heading } from "../comp/core/Heading";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TypeBase } from "./base/TypeBase";
import { TabDataIntf } from "../intf/TabDataIntf";

export class RepoRootTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.REPO_ROOT, "Root", "fa-home", false);
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, tabData: TabDataIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new HorizontalLayout([
            new Heading(4, "Root")
        ], "displayTable systemNodeContent marginAll");
    }
}
