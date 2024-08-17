import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabIntf } from "../intf/TabIntf";
import { TypeBase } from "./base/TypeBase";

export class PostsType extends TypeBase {
    constructor() {
        super(J.NodeType.POSTS, "Posts", "fa-comments-o", false);
    }

    override isSpecialAccountNode(): boolean {
        return true;
    }

    override render = (_node: NodeInfo, _tabData: TabIntf<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Posts", { className: "noMargin" })
        ]);
    }

    override getEditorHelp(): string {
        return S.quanta.cfg.help?.editor?.dialog;
    }
}
