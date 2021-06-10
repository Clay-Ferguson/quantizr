import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { Comp } from "../widget/base/Comp";
import { Heading } from "../widget/Heading";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { TypeBase } from "./base/TypeBase";

export class RepoRootTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.REPO_ROOT, "Root", "fa-home", false);
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new HorizontalLayout([
            new Heading(4, "Root")
        ], "marginAll");
    }
}
