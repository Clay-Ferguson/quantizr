import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Form } from "../comp/core/Form";
import { HelpButton } from "../comp/core/HelpButton";
import { EditPrivsTable } from "../comp/EditPrivsTable";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { FriendsDlg } from "./FriendsDlg";

interface LS { // Local State
    nodePrivsInfo?: J.GetNodePrivilegesResponse;
    recursive?: boolean;
}

export class SharingDlg extends DialogBase {
    dirty: boolean = false;

    constructor(private node: J.NodeInfo, state: AppState) {
        super("Node Sharing", "app-modal-content-medium-width", null, state);
        this.mergeState<LS>({ nodePrivsInfo: null, recursive: false });
    }

    renderDlg(): CompIntf[] {
        let isPublic = S.props.isPublic(this.node);
        let state: LS = this.getState<LS>();

        return [
            new Form(null, [
                new Div("Note: All usernames mentioned in the content text will also be automatically added to this sharing list when you save the node, " +
                    "so you don't need to add users here if they're mentioned when you save.", { className: "marginBottom" }),
                new EditPrivsTable((allowAppends: boolean) => {
                    this.shareNodeToPublic(allowAppends);
                }, this.getState<LS>().nodePrivsInfo, this.removePrivilege),
                S.props.isShared(this.node) ? new Div("Remove All", {
                    className: "marginBottom marginRight float-end clickable",
                    onClick: this.removeAllPrivileges
                }) : null,
                new Clearfix(),
                new Checkbox("Unpublished", null, {
                    setValue: async (checked: boolean): Promise<void> => {
                        let state: LS = this.getState<LS>();
                        this.dirty = true;
                        state.nodePrivsInfo.unpublished = checked;
                        await S.util.ajax<J.SetUnpublishedRequest, J.AddPrivilegeResponse>("setUnpublished", {
                            nodeId: this.node.id,
                            unpublished: checked
                        });

                        this.mergeState<LS>({ nodePrivsInfo: state.nodePrivsInfo });
                        return null;
                    },
                    getValue: (): boolean => {
                        return state.nodePrivsInfo.unpublished;
                    }
                }),
                new Checkbox("Apply to all children (that you own)", null, {
                    setValue: (checked: boolean): void => {
                        this.dirty = true;
                        this.mergeState<LS>({ recursive: checked });
                    },
                    getValue: (): boolean => {
                        return state.recursive;
                    }
                }),
                new ButtonBar([
                    new Button("Add Person", async () => {
                        let friendsDlg: FriendsDlg = new FriendsDlg(this.node, this.appState, true);
                        await friendsDlg.open();
                        if (friendsDlg.getState().selectedName) {
                            this.dirty = true;
                            this.shareImmediate(friendsDlg.getState().selectedName);
                        }
                    }, null, "btn-primary"),
                    isPublic ? null : new Button("Make Public", () => this.shareNodeToPublic(false), null, "btn-secondary"),
                    new Button("Done", () => {
                        this.close();
                    }, null, "btn-secondary float-end"),
                    new HelpButton(() => this.appState.config?.help?.sharing?.dialog)
                ], "marginTop")
            ])
        ];
    }

    shareImmediate = async (userName: string) => {
        let state: LS = this.getState<LS>();

        await S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: this.node.id,
            principal: userName,
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
        let res: J.GetNodePrivilegesResponse = await S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: this.node.id,
            includeAcl: true,
            includeOwners: true
        });
        this.node.ac = res.aclEntries;
        this.mergeState<LS>({ nodePrivsInfo: res });
    }

    removeAllPrivileges = async () => {
        this.dirty = true;
        let res: J.RemovePrivilegeResponse = await S.util.ajax<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: this.node.id,
            principalNodeId: "*",
            privilege: "*"
        });

        this.removePrivilegeResponse();
    }

    public close(): void {
        super.close();
        if (this.dirty) {
            // console.log("Sharing dirty=true. Full refresh pending.");
            if (this.getState<LS>().recursive) {
                setTimeout(async () => {
                    let res: J.CopySharingResponse = await S.util.ajax<J.CopySharingRequest, J.CopySharingResponse>("copySharing", {
                        nodeId: this.node.id
                    });
                    S.quanta.refresh(this.appState);
                }, 100);
            }
            else {
                S.quanta.refresh(this.appState);
            }
        }
    }

    removePrivilege = async (principalNodeId: string, privilege: string) => {
        this.dirty = true;
        let res: J.RemovePrivilegeResponse = await S.util.ajax<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: this.node.id,
            principalNodeId,
            privilege
        });
        this.removePrivilegeResponse();
    }

    removePrivilegeResponse = async () => {
        let res: J.GetNodePrivilegesResponse = await S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: this.node.id,
            includeAcl: true,
            includeOwners: true
        });

        this.node.ac = res.aclEntries;
        this.mergeState<LS>({ nodePrivsInfo: res });
    }

    shareNodeToPublic = async (allowAppends: boolean) => {
        this.dirty = true;
        let encrypted = S.props.isEncrypted(this.node);
        if (encrypted) {
            S.util.showMessage("This node is encrypted, and therefore cannot be made public.", "Warning");
            return;
        }

        /*
         * Add privilege and then reload share nodes dialog from scratch doing another callback to server
         *
         * TODO: this additional call can be avoided as an optimization
         */
        await S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: this.node.id,
            principal: "public",
            privileges: allowAppends ? [J.PrivilegeType.READ, J.PrivilegeType.WRITE] : [J.PrivilegeType.READ]
        });

        this.reload();
    }
}
