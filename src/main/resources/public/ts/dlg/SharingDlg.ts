import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { EditPrivsTable } from "../widget/EditPrivsTable";
import { Form } from "../widget/Form";
import { FriendsDlg } from "./FriendsDlg";
import { ShareToPersonDlg } from "./ShareToPersonDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SharingDlg extends DialogBase {
    static helpExpanded: boolean = false;
    dirty: boolean = false;

    constructor(private node: J.NodeInfo, state: AppState) {
        super("Node Sharing", "app-modal-content-medium-width", null, state);
        this.mergeState({ nodePrivsInfo: null });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new CollapsibleHelpPanel("Help", S.meta64.config.help.sharing.dialog,
                    (state: boolean) => {
                        SharingDlg.helpExpanded = state;
                    }, SharingDlg.helpExpanded, "div", "marginBottom"),
                new EditPrivsTable(this.getState().nodePrivsInfo, this.removePrivilege),
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
                        if (this.dirty) {
                            S.meta64.refresh(this.appState);
                        }
                    })
                ])
            ])
        ];
    }

    shareImmediate = (userName: string) => {
        S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: this.node.id,
            principal: userName,
            privileges: [J.PrivilegeType.READ, J.PrivilegeType.WRITE]
        }, this.reload);
    }

    preLoad(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                this.reload();
            } finally {
                resolve();
            }
        });
    }

    /*
     * Gets privileges from server and saves into state.
     */
    reload = (): void => {
        S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: this.node.id,
            includeAcl: true,
            includeOwners: true
        }, (res: J.GetNodePrivilegesResponse): void => {
            this.node.ac = res.aclEntries;
            this.mergeState({ nodePrivsInfo: res });
        });
    }

    removePrivilege = (principalNodeId: string, privilege: string): void => {
        this.dirty = true;
        S.util.ajax<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: this.node.id,
            principalNodeId,
            privilege
        }, this.removePrivilegeResponse);
    }

    removePrivilegeResponse = (res: J.RemovePrivilegeResponse): void => {
        S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: this.node.id,
            includeAcl: true,
            includeOwners: true
        }, (res: J.GetNodePrivilegesResponse): void => {
            this.node.ac = res.aclEntries;
            this.mergeState({ nodePrivsInfo: res });
        });
    }

    shareToPersonDlg = async (): Promise<void> => {
        this.dirty = true;
        let dlg = new ShareToPersonDlg(this.node, this.reload, this.appState);
        await dlg.open();

        // this promise currently isn't needed
        return null;
    }

    shareNodeToPublic = (allowAppends: boolean): void => {
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
        S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: this.node.id,
            principal: "public",
            privileges: allowAppends ? [J.PrivilegeType.READ, J.PrivilegeType.WRITE] : [J.PrivilegeType.READ]
        }, this.reload);
    }
}
