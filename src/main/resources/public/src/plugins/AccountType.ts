import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { TabBase } from "../intf/TabBase";
import { NodeActionType } from "../intf/TypeIntf";
import { TypeBase } from "./base/TypeBase";

export class AccountType extends TypeBase {
    constructor() {
        super(J.NodeType.ACCOUNT, "Account Root", "fa-database", false);
    }

    override getAllowRowHeader(): boolean {
        return false;
    }

    override allowAction(action: NodeActionType, _node: NodeInfo): boolean {
        switch (action) {
            case NodeActionType.editNode:
                return false;
            default:
                return true;
        }
    }

    override allowPropertyEdit(_propName: string): boolean {
        return true;
    }

    override render = (node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        let aiConfigDiv = null;
        if (S.props.getPropStr(J.NodeProp.AI_AGENT, node)) {
            aiConfigDiv = new Div("AI Agent", {
                onClick: () => S.edit.configureAgent(node),
                className: "nodeTags aiTags mb-1 float-right",
                title: "Configure Agent Settings"
            });
        }
        const name = S.nodeUtil.getDisplayName(node);
        return new Div(null, {
            className: "systemNodeContent"
        }, [
            aiConfigDiv,
            new Heading(4, "User: " + name, {
                className: "cursor-pointer noMargin",
                onClick: () => {
                    // If we're clicking on our own Account Node, then don't open the
                    // UserProfileDlg. For a person editing their own account this is not a way to
                    // do it.
                    if (!S.props.isMine(node)) {
                        new UserProfileDlg(node.ownerId).open();
                    }
                }
            })
        ]);
    }
}
