import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ShareToPersonDlg extends DialogBase {

    shareToUserTextField: TextField;

    constructor(private node: J.NodeInfo, private sharedNodeFunc: Function) {
        super("Share Node to Person", "app-modal-content-medium-width");

        this.setChildren([
            new Form(null, [
                new TextContent("Enter the username of the person you want to share this node with:"),
                this.shareToUserTextField = new TextField("User to Share With", {
                    onKeyPress: (e: KeyboardEvent) => {
                        if (e.which == 13) { // 13==enter key code
                            this.shareNodeToPerson();
                            return false;
                        }
                    }
                }),
                new ButtonBar([
                    new Button("Share", () => {
                        this.shareNodeToPerson();
                        this.close();
                    }, null, "primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);
    }

    shareNodeToPerson = (): void => {
        let targetUser = this.shareToUserTextField.getValue();
        if (!targetUser) {
            S.util.showMessage("Please enter a username");
            return;
        }

        /* Trigger update from server at next main page refresh */
        S.meta64.treeDirty = true;

        S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            "nodeId": this.node.id,
            "principal": targetUser,
            "privileges": ["rd", "wr"],
        }, this.reloadFromShareWithPerson);
    }

    reloadFromShareWithPerson = async (res: J.AddPrivilegeResponse): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            if (S.util.checkSuccess("Share Node with Person", res)) {
                if (res.principalPublicKey) {
                    await S.share.addCipherKeyToNode(this.node, res.principalPublicKey, res.principalNodeId);
                }
                this.sharedNodeFunc(res);
            }
            resolve();
        });
    }
}
