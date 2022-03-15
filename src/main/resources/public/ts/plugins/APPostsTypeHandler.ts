import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class APPostsTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.ACT_PUB_POSTS, "Posts", "fa-comments-o", true);
    }

    render(node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Posts", {
                className: "marginAll"
            })
        ]);
    }

    getIconClass(): string {
        return super.getIconClass();
    }

    getEditorHelp(): string {
        return S.quanta?.config?.help?.editor?.dialog;
    }
}
