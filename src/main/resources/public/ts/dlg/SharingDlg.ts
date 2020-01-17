import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import { ShareToPersonDlg } from "./ShareToPersonDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { EditPrivsTable } from "../widget/EditPrivsTable";
import { EditPrivsTableRow } from "../widget/EditPrivsTableRow";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SharingDlg extends DialogBase {

    privsTable: EditPrivsTable;
    //publicCommentingCheckbox: Checkbox;

    constructor() {
        super("Node Sharing");

        this.setChildren([
            new Form(null, [
                this.privsTable = new EditPrivsTable(),
                //todo-2: disabling this for now
                //this.publicCommentingCheckbox = new Checkbox("Allow Public Commenting"),
                new ButtonBar([
                    new Button("Share with Person", this.shareToPersonDlg),
                    new Button("Share to Public", this.shareNodeToPublic),
                    new Button("Save", () => {
                        this.save();
                        this.close();
                    }),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);
    }

    init = (): void => {
        this.reload();
    }

    /*
     * Gets privileges from server and displays in GUI also. Assumes gui is already at correct page.
     */
    reload = (): void => {
        console.log("Loading node sharing info.");

        S.util.ajax<I.GetNodePrivilegesRequest, I.GetNodePrivilegesResponse>("getNodePrivileges", {
            "nodeId": S.share.sharingNode.id,
            "includeAcl": true,
            "includeOwners": true
        }, this.populate);
    }

    /*
     * Processes the response gotten back from the server containing ACL info so we can populate the sharing page in the gui
     */
    populate = (res: I.GetNodePrivilegesResponse): void => {
        this.privsTable.removeAllChildren();

        if (res.aclEntries) {
            res.aclEntries.forEach((aclEntry) => {
                this.privsTable.addChild(new EditPrivsTableRow(this, aclEntry));
            });
        }
        
        //todo-0: change this the same way we changed EditNodeDlg to work. (without this)
        this.privsTable.reactRenderToDOM();

        //this.publicCommentingCheckbox.setChecked(res.publicAppend);
    }

    /* Note: this really only saves the checkbox value because the other list modifications are made as soon as user does them */
    save = (): void => {
        S.meta64.treeDirty = true;
        S.util.ajax<I.AddPrivilegeRequest, I.AddPrivilegeResponse>("addPrivilege", {
            "nodeId": S.share.sharingNode.id,
            "privileges": null,
            "principal": null,
            "publicAppend": false //this.publicCommentingCheckbox.getChecked()
        });
    }

    removePrivilege = (principalNodeId: string, privilege: string): void => {
        S.meta64.treeDirty = true;
        S.util.ajax<I.RemovePrivilegeRequest, I.RemovePrivilegeResponse>("removePrivilege", {
            "nodeId": S.share.sharingNode.id,
            "principalNodeId": principalNodeId,
            "privilege": privilege
        }, this.removePrivilegeResponse);
    }

    removePrivilegeResponse = (res: I.RemovePrivilegeResponse): void => {
        S.util.ajax<I.GetNodePrivilegesRequest, I.GetNodePrivilegesResponse>("getNodePrivileges", {
            "nodeId": S.share.sharingNode.path,
            "includeAcl": true,
            "includeOwners": true
        }, this.populate);
    }

    shareToPersonDlg = (): void => {
        new ShareToPersonDlg({ "sharingDlg": this }).open();
    }

    shareNodeToPublic = (): void => {
        console.log("Sharing node to public.");
        S.meta64.treeDirty = true;

        /*
         * Add privilege and then reload share nodes dialog from scratch doing another callback to server
         *
         * TODO: this additional call can be avoided as an optimization
         */
        S.util.ajax<I.AddPrivilegeRequest, I.AddPrivilegeResponse>("addPrivilege", {
            "nodeId": S.share.sharingNode.id,
            "principal": "public",
            "privileges": ["rd"],
            "publicAppend": false
        }, this.reload);
    }
}
