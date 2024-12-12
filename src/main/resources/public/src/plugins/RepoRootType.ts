import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabBase } from "../intf/TabBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";
import { S } from "../Singletons";

export class RepoRootType extends TypeBase {
    constructor() {
        super(J.NodeType.REPO_ROOT, "Root", "fa-home", false);
    }

    override allowPropertyEdit(_propName: string): boolean {
        return true;
    }

    override render = (node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        let aiConfigDiv = null;
        if (S.props.getPropStr(J.NodeProp.AI_CONFIG, node)) {
            aiConfigDiv = new Div("AI Settings", {
                onClick: () => S.edit.configureAgent(node),
                className: "nodeTags aiTags mb-1 float-right",
                title: "Configure Agent Settings"
            });
        }
        return new Div(null, { className: "systemNodeContent" }, [
            aiConfigDiv,
            new Heading(4, "Root", { className: "noMargin" }),
        ]);
    }
}
