import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";
import { FriendsDlg } from "./FriendsDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ShareToPersonDlg extends DialogBase {

    constructor(private node: J.NodeInfo, private sharedNodeFunc: Function, state: AppState) {
        super("Share Node to Person", "app-modal-content-medium-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter the user name of the person you want to share this node with:"),
                new TextField("User to share with", false, this.shareNodeToPerson, null, 
                    new CompValueHolder<string>(this, "userName")),
                new ButtonBar([

                    new Button("Share", () => {
                        this.shareNodeToPerson();
                        this.close();
                    }, null, "btn-primary"),

                    new Button("Choose Friend", async () => {
                        let friendsDlg: FriendsDlg = new FriendsDlg(this.appState);
                        await friendsDlg.open();
                        if (friendsDlg.getState().selectedName) {
                            this.close();
                            this.shareToPersonImmediate(friendsDlg.getState().selectedName);
                        }
                    }, null, "btn-primary"),

                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    shareNodeToPerson = (): void => {
        let targetUser = this.getState().userName;
        if (!targetUser) {
            S.util.showMessage("Please enter a username", "Warning");
            return;
        }

        let appState = store.getState();
        if (targetUser === appState.userName) {
            S.util.showMessage("You can't share a node to yourself.", "Warning");
            return;
        }

        this.shareToPersonImmediate(targetUser);
    }

    shareToPersonImmediate = (userName: string) => {
        S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: this.node.id,
            principal: userName,
            privileges: [J.PrivilegeType.READ, J.PrivilegeType.WRITE]
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
