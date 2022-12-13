import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { Comp } from "../comp/base/Comp";
import { Heading } from "../comp/core/Heading";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TypeBase } from "./base/TypeBase";
import { TabIntf } from "../intf/TabIntf";

export class RepoRootType extends TypeBase {
    constructor() {
        super(J.NodeType.REPO_ROOT, "Root", "fa-home", false);
    }

    allowPropertyEdit(propName: string, ast: AppState): boolean {
        return true;
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, ast: AppState): Comp => {
        return new HorizontalLayout([
            new Heading(4, "Root", { className: "noMargin" })
        ], "displayTable systemNodeContent");
    }
}
