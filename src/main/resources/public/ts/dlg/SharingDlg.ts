import { getAppState } from "../AppContext";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { HelpButton } from "../comp/core/HelpButton";
import { EditPrivsTable } from "../comp/EditPrivsTable";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { FriendsDlg, LS as FriendsDlgLS } from "./FriendsDlg";

interface LS { // Local State
    recursive?: boolean;
}

export class SharingDlg extends DialogBase {
    dirty: boolean = false;

    constructor() {
        super("Node Sharing", "app-modal-content-medium-width");
        this.mergeState<LS>({ recursive: false });
    }

    renderDlg(): CompIntf[] {
        const appState = getAppState();
        const isPublic = S.props.isPublic(appState.editNode);
        const state: LS = this.getState<LS>();
        const numShares: number = appState.editNode.ac?.length;

        return [
            new Div(null, null, [
                numShares > 0 ? new Div("The following people have access to this node...", { className: "marginBottom" }) : null,
                new EditPrivsTable((userName: string, allowAppends: boolean) => {
                    this.shareNodeToUser(userName, allowAppends);
                }, appState.editNode.ac, this.removePrivilege),
                S.props.isShared(appState.editNode) ? new Div("Remove All", {
                    className: "marginBottom marginRight float-end clickable",
                    onClick: this.removeAllPrivileges
                }) : null,
                new Clearfix(),
                appState.editNode.ac?.length > 0 ? new Checkbox("Unpublished", null, {
                    setValue: async (checked: boolean) => {
                        this.dirty = true;
                        await S.rpcUtil.rpc<J.SetUnpublishedRequest, J.AddPrivilegeResponse>("setUnpublished", {
                            nodeId: appState.editNode.id,
                            unpublished: checked
                        });
                        S.props.setPropVal(J.NodeProp.UNPUBLISHED, appState.editNode, checked ? "true" : null);
                        S.edit.updateNode(appState.editNode);
                        return null;
                    },
                    getValue: (): boolean => {
                        return !!S.props.getPropStr(J.NodeProp.UNPUBLISHED, appState.editNode);
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
                    new Button("Choose People", async () => {
                        const friendsDlg: FriendsDlg = new FriendsDlg();
                        await friendsDlg.open();
                        if (friendsDlg.getState<FriendsDlgLS>().selections?.size > 0) {
                            this.dirty = true;
                            const names: string[] = [];
                            friendsDlg.getState<FriendsDlgLS>().selections.forEach(n => names.push(n));
                            this.shareImmediate(names);
                        }
                    }, null, "btn-primary"),
                    isPublic ? null : new Button("Make Public", () => this.shareNodeToUser(J.PrincipalName.PUBLIC, false), null, "btn-secondary"),
                    new Button("Done", () => {
                        this.close();
                    }, null, "btn-secondary float-end"),
                    new HelpButton(() => getAppState().config.help?.sharing?.dialog)
                ], "marginTop")
            ])
        ];
    }

    shareImmediate = async (names: string[]) => {
        const appState = getAppState();
        await S.rpcUtil.rpc<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: appState.editNode.id,
            principals: names,
            privileges: [J.PrivilegeType.READ, J.PrivilegeType.WRITE]
        });
        this.reload();
    }

    async preLoad(): Promise<void> {
        await this.reload();
    }

    /*
     * Gets privileges from server and saves into state.
     */
    reload = async () => {
        const appState = getAppState();
        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: appState.editNode.id
        });
        appState.editNode.ac = res.aclEntries;
        S.edit.updateNode(appState.editNode);
    }

    removeAllPrivileges = async () => {
        this.dirty = true;
        const appState = getAppState();
        await S.rpcUtil.rpc<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: appState.editNode.id,
            principalNodeId: "*",
            privilege: "*"
        });

        this.removePrivilegeResponse();
    }

    super_close = this.close;
    close = () => {
        this.super_close();
        if (this.dirty) {
            // console.log("Sharing dirty=true. Full refresh pending.");
            if (this.getState<LS>().recursive) {
                setTimeout(async () => {
                    const appState = getAppState();
                    await S.rpcUtil.rpc<J.CopySharingRequest, J.CopySharingResponse>("copySharing", {
                        nodeId: appState.editNode.id
                    });

                    S.quanta.refresh(getAppState());
                }, 100);
            }
        }
    }

    removePrivilege = async (principalNodeId: string, privilege: string) => {
        this.dirty = true;
        const appState = getAppState();
        await S.rpcUtil.rpc<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: appState.editNode.id,
            principalNodeId,
            privilege
        });
        this.removePrivilegeResponse();
    }

    removePrivilegeResponse = async () => {
        const appState = getAppState();
        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: appState.editNode.id
        });

        appState.editNode.ac = res.aclEntries;
        S.edit.updateNode(appState.editNode);
    }

    // userName="public", or a username
    shareNodeToUser = async (userName: string, allowAppends: boolean) => {
        this.dirty = true;
        const appState = getAppState();
        if (S.props.isEncrypted(appState.editNode)) {
            S.util.showMessage("This node is encrypted, and therefore cannot be made public.", "Warning");
            return;
        }

        /*
         * Add privilege and then reload share nodes dialog from scratch doing another callback to server
         *
         * TODO: this additional call can be avoided as an optimization
         */
        await S.rpcUtil.rpc<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: appState.editNode.id,
            principals: [userName],
            privileges: allowAppends ? [J.PrivilegeType.READ, J.PrivilegeType.WRITE] : [J.PrivilegeType.READ]
        });

        this.reload();
    }
}
