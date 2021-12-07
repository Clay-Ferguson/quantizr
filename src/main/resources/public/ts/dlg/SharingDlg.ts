import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Clearfix } from "../comp/Clearfix";
import { Div } from "../comp/Div";
import { EditPrivsTable } from "../comp/EditPrivsTable";
import { Form } from "../comp/Form";
import { HelpButton } from "../comp/HelpButton";
import { FriendsDlg } from "./FriendsDlg";
import { ShareToPersonDlg } from "./ShareToPersonDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    nodePrivsInfo: J.GetNodePrivilegesResponse;
}

export class SharingDlg extends DialogBase {
    dirty: boolean = false;

    constructor(private node: J.NodeInfo, state: AppState) {
        super("Node Sharing", "app-modal-content-medium-width", null, state);
        this.mergeState<LS>({ nodePrivsInfo: null });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new EditPrivsTable(this.getState<LS>().nodePrivsInfo, this.removePrivilege),
                S.props.isShared(this.node) ? new Div("Remove All", {
                    className: "marginBottom marginRight float-end clickable",
                    onClick: this.removeAllPrivileges
                }) : null,
                new Clearfix(),
                new ButtonBar([
                    new Button("Add User", this.shareToPersonDlg, null, "btn-primary"),
                    new Button("Add Friend", async () => {
                        let friendsDlg: FriendsDlg = new FriendsDlg(this.appState, true);
                        await friendsDlg.open();
                        if (friendsDlg.getState().selectedName) {
                            this.shareImmediate(friendsDlg.getState().selectedName);
                        }
                    }, null, "btn-primary"),
                    new Button("Public (Allow replies)", () => { this.shareNodeToPublic(true); }, null, "btn-secondary"),
                    new Button("Public (No replies)", () => { this.shareNodeToPublic(false); }, null, "btn-secondary"),
                    new Button("Close", () => {
                        this.close();
                        if (this.dirty && this.appState.activeTab === C.TAB_MAIN) {
                            S.quanta.refresh(this.appState);
                        }
                    }),
                    new HelpButton(() => S.quanta?.config?.help?.sharing?.dialog)
                ], "marginTop")
            ])
        ];
    }

    shareImmediate = async (userName: string) => {
        await S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: this.node.id,
            principal: userName,
            privileges: [J.PrivilegeType.READ, J.PrivilegeType.WRITE]
        });
        this.reload();
    }

    async preLoad(): Promise<void> {
        // Note: 11/15/21 the 'await' is new here. This was all synchronous before (i.e. immediately resolved promise)
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

        // Give user time to see the removal, and then close out the dialog.
        setTimeout(() => {
            this.close();
        }, 1000);
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

    shareToPersonDlg = async (): Promise<void> => {
        this.dirty = true;
        let dlg = new ShareToPersonDlg(this.node, this.reload, this.appState);
        await dlg.open();

        // this promise currently isn't needed
        return null;
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
