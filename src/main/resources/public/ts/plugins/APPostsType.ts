import { getAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class APPostsType extends TypeBase {
    constructor() {
        super(J.NodeType.ACT_PUB_POSTS, "Fediverse Posts", "fa-comments-o", false);
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, ast: AppState): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Posts", {
                className: "noMargin"
            })
        ]);
    }

    getEditorHelp(): string {
        const ast = getAppState();
        return ast.config.help?.editor?.dialog;
    }
}
