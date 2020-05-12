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
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ShareToPersonDlg extends DialogBase {

    shareToUserTextField: TextField;

    constructor(private node: J.NodeInfo, private sharedNodeFunc: Function, state: AppState) {
        super("Share Node to Person", "app-modal-content-medium-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter the username of the person you want to share this node with:"),
                this.shareToUserTextField = new TextField("User to Share With", null, false, this.shareNodeToPerson),
                new ButtonBar([
                    new Button("Share", () => {
                        this.shareNodeToPerson();
                        this.close();
                    }, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    shareNodeToPerson = (): void => {
        let targetUser = this.shareToUserTextField.getValue();
        if (!targetUser) {
            S.util.showMessage("Please enter a username", "Warning");
            return;
        }

        S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            "nodeId": this.node.id,
            "principal": targetUser,
            "privileges": [J.PrivilegeType.READ, J.PrivilegeType.WRITE],
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
