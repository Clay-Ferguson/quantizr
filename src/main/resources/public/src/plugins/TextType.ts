import { Comp } from "../comp/base/Comp";
import { Pre } from "../comp/core/Pre";
import { EditorOptions } from "../Interfaces";
import { TabBase } from "../intf/TabBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

/* Type for 'untyped' types. That is, if the user has not set a type explicitly this type will be
the default */
export class TextType extends TypeBase {
    constructor() {
        super(J.NodeType.PLAIN_TEXT, "Text", "fa-file-lines", true);
    }

    override render = (node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        const wordWrap = S.props.getPropStr(J.NodeProp.NOWRAP, node) !== "1";
        return new Pre(S.domUtil.escapeHtml(node.content), { className: "textTypeContent" + (wordWrap ? " preWordWrap" : "") });
    }

    override getEditorOptions(): EditorOptions {
        return {
            tags: true,
            nodeName: true,
            priority: true,
            wordWrap: true,
            encrypt: true,
        };
    }
}
