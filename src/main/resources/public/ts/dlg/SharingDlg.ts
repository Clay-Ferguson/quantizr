import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { ShareToPersonDlg } from "./ShareToPersonDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { EditPrivsTable } from "../widget/EditPrivsTable";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SharingDlg extends DialogBase {

    //node being operated on by this Dialog.
    node: J.NodeInfo;

    privsTable: EditPrivsTable;
    nodePrivsInfo: I.NodePrivilegesInfo;
    dirty: boolean = false;

    constructor(node: J.NodeInfo, state: AppState) {
        super("Node Sharing", "app-modal-content-medium-width", null, false, state);
        this.node = node;
    }

    preRender = () => {
        this.initChildren();
        this.reload();
    }

    /*
     * Gets privileges from server and displays in GUI also. Assumes gui is already at correct page.
     */
    reload = (): void => {
        S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            "nodeId": this.node.id,
            "includeAcl": true,
            "includeOwners": true
        }, this.populate);
    }

    /*
     * Processes the response gotten back from the server containing ACL info so we can populate the sharing page in the gui
     */
    populate = (res: J.GetNodePrivilegesResponse): void => {
        //console.log("populating with: res="+S.util.prettyPrint(res));
        this.privsTable.setState(res); 
        this.privsTable.updateDOM();
    }

    removePrivilege = (principalNodeId: string, privilege: string): void => {
        S.util.ajax<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            "nodeId": this.node.id,
            "principalNodeId": principalNodeId,
            "privilege": privilege
        }, this.removePrivilegeResponse);
    }

    removePrivilegeResponse = (res: J.RemovePrivilegeResponse): void => {
        S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            "nodeId": this.node.id,
            "includeAcl": true,
            "includeOwners": true
        }, this.populate);
    }

    shareToPersonDlg = (): void => {
        let dlg = new ShareToPersonDlg(this.node, this.reload, this.appState);
        dlg.open();
    }

    shareNodeToPublic = (): void => {
        let encrypted = S.props.isEncrypted(this.node);
        if (encrypted) {
            S.util.showMessage("This node is encrypted, and therefore cannot be made public.");
            return;
        }

        console.log("Sharing node to public.");

        /*
         * Add privilege and then reload share nodes dialog from scratch doing another callback to server
         *
         * TODO: this additional call can be avoided as an optimization
         */
        S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            "nodeId": this.node.id,
            "principal": "public",
            "privileges": [J.PrivilegeType.READ],
        }, this.reload);
    }

    initChildren = (): void => {
        this.setChildren([
            new Form(null, [
                this.privsTable = new EditPrivsTable(this.nodePrivsInfo, this.removePrivilege),
                new ButtonBar([
                    new Button("Share with Person", this.shareToPersonDlg, null, "btn-primary"),
                    new Button("Share to Public", this.shareNodeToPublic, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                        S.meta64.refresh(this.appState);
                    })
                ])
            ])
        ]);
    }
}
