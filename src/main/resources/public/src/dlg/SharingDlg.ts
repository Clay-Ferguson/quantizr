import { getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { EditPrivsTable } from "../comp/EditPrivsTable";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PrincipalName } from "../JavaIntf";
import { S } from "../Singletons";
import { FriendsDlg, LS as FriendsDlgState } from "./FriendsDlg";

interface LS { // Local State
    recursive?: boolean;
}

export class SharingDlg extends DialogBase {
    dirty: boolean = false;

    constructor() {
        super("Node Sharing");
        this.mergeState<LS>({ recursive: false });
    }

    renderDlg(): Comp[] {
        const ast = getAs();
        const isPublic = S.props.isPublic(ast.editNode);
        const state: LS = this.getState<LS>();
        const numShares: number = ast.editNode.ac?.length;

        return [
            new Div(null, null, [
                numShares > 0 ? new Div("The following people have access to this node...", { className: "mb-3" }) : null,
                new EditPrivsTable((userName: string, allowAppends: boolean) => {
                    this.shareNodeToUser(userName, allowAppends);
                }, ast.editNode.ac, this._removePrivilege),
                S.props.isShared(ast.editNode) ? new Div("Remove All", {
                    className: "mr-3 float-right cursor-pointer",
                    onClick: this._removeAllPrivileges
                }) : null,
                new Clearfix(),
                ast.editNode.ac?.length > 0 ? new Checkbox("Unpublished", null, {
                    setValue: async (checked: boolean) => {
                        this.dirty = true;
                        await S.rpcUtil.rpc<J.SetSharingOptionRequest, J.SetSharingOptionResponse>("setSharingOption", {
                            nodeId: ast.editNode.id,
                            unpublished: checked,
                            website: S.props.getPropStr(J.NodeProp.WEBSITE, ast.editNode) ? true : false
                        });
                        S.props.setPropVal(J.NodeProp.UNPUBLISHED, ast.editNode, checked ? "true" : null);
                        S.edit.updateNode(ast.editNode);
                        return null;
                    },
                    getValue: (): boolean => {
                        return !!S.props.getPropStr(J.NodeProp.UNPUBLISHED, ast.editNode);
                    }
                }) : null,
                S.props.isPublic(ast.editNode) ? new Checkbox("Website", null, {
                    setValue: async (checked: boolean) => {
                        this.dirty = true;
                        await S.rpcUtil.rpc<J.SetSharingOptionRequest, J.SetSharingOptionResponse>("setSharingOption", {
                            nodeId: ast.editNode.id,
                            unpublished: S.props.getPropStr(J.NodeProp.UNPUBLISHED, ast.editNode) ? true : false,
                            website: checked
                        });
                        S.props.setPropVal(J.NodeProp.WEBSITE, ast.editNode, checked ? "true" : null);
                        S.edit.updateNode(ast.editNode);
                        return null;
                    },
                    getValue: (): boolean => {
                        return !!S.props.getPropStr(J.NodeProp.WEBSITE, ast.editNode);
                    }
                }) : null,
                new Checkbox("Apply to Subnodes", null, {
                    setValue: (checked: boolean) => {
                        this.dirty = true;
                        this.mergeState<LS>({ recursive: checked });
                    },
                    getValue: (): boolean => state.recursive
                }),
                new ButtonBar([
                    new Button("Add People", async () => {
                        const friendsDlg: FriendsDlg = new FriendsDlg("Follows", null, false, false);
                        await friendsDlg.open();
                        if (friendsDlg.getState<FriendsDlgState>().selections?.size > 0) {
                            this.dirty = true;
                            const names: string[] = [];
                            friendsDlg.getState<FriendsDlgState>().selections.forEach(n => names.push(n));
                            this.shareImmediate(names);
                        }
                    }, null, "-primary"),
                    isPublic ? null : new Button("Make Public", () => this.shareNodeToUser(PrincipalName.PUBLIC, false), null, "ui-share-make-public"),
                    new Button("Done", () => this.close(), null, "float-right ui-sharing-done")
                ], "mt-3")
            ])
        ];
    }

    async shareImmediate(names: string[]) {
        const ast = getAs();
        const res = await S.rpcUtil.rpc<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: ast.editNode.id,
            principals: names,
            privileges: [J.PrivilegeType.READ, J.PrivilegeType.WRITE]
        });
        await S.edit.distributeKeys(ast.editNode, res.aclEntries);
        this.reload();
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }

    /*
     * Gets privileges from server and saves into state.
     */
    async reload() {
        const ast = getAs();
        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: ast.editNode.id
        });
        ast.editNode.ac = res.aclEntries;
        S.edit.updateNode(ast.editNode);
    }

    _removeAllPrivileges = async () => {
        this.dirty = true;
        const ast = getAs();
        await S.rpcUtil.rpc<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: ast.editNode.id,
            principalNodeId: "*",
            privilege: "*"
        });

        this.removePrivilegeResponse();
    }

    override close() {
        super.close();

        if (this.dirty) {
            if (this.getState<LS>().recursive) {
                setTimeout(() => {
                    const ast = getAs();
                    S.rpcUtil.rpc<J.CopySharingRequest, J.CopySharingResponse>("copySharing", {
                        nodeId: ast.editNode.id
                    }).then(() => {
                        S.quanta.refresh();
                    });
                }, 100);
            }
        }
    }

    _removePrivilege = async (principalNodeId: string, privilege: string) => {
        this.dirty = true;
        const ast = getAs();
        await S.rpcUtil.rpc<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: ast.editNode.id,
            principalNodeId,
            privilege
        });
        this.removePrivilegeResponse();
    }

    async removePrivilegeResponse() {
        const ast = getAs();
        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: ast.editNode.id
        });

        ast.editNode.ac = res.aclEntries;
        S.edit.updateNode(ast.editNode);
    }

    // userName="public", or a username
    async shareNodeToUser(userName: string, allowAppends: boolean) {
        this.dirty = true;
        const ast = getAs();
        if (S.props.isEncrypted(ast.editNode)) {
            S.util.showMessage("This node is encrypted, and therefore cannot be made public.", "Warning");
            return;
        }

        /*
         * Add privilege and then reload share nodes dialog from scratch doing another callback to
         * server
         *
         * TODO: this additional call can be avoided as an optimization
         */
        await S.rpcUtil.rpc<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: ast.editNode.id,
            principals: [userName],
            privileges: allowAppends ? [J.PrivilegeType.READ, J.PrivilegeType.WRITE] : [J.PrivilegeType.READ]
        });

        // Since this is a common usage pattern, let's automatically set the unpublished and
        // recursive flags
        if (userName == PrincipalName.PUBLIC) {
            this.mergeState<LS>({ recursive: true });
            S.props.setPropVal(J.NodeProp.UNPUBLISHED, ast.editNode, "true");
        }

        this.reload();
    }
}
