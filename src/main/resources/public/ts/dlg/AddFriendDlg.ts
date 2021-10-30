import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextField } from "../widget/TextField";
import * as J from "../JavaIntf";
import { HorizontalLayout } from "../widget/HorizontalLayout";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class AddFriendDlg extends DialogBase {
    userState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Add Friend", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new HorizontalLayout([
                    new TextField("User Name", false, this.addFriend, null, false, this.userState)
                ]),
                new ButtonBar([
                    new Button("Add Friend", this.addFriend, null, "btn-primary"),
                    new Button("Close", this.close)
                ], "marginTop")
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;
        if (!this.userState.getValue()) {
            this.userState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.userState.setError(null);
        }
        return valid;
    }

    preLoad = async () => {
    }

    addFriend = (): void => {
        if (!this.validate()) {
            return;
        }
        let userName = this.userState.getValue();
        if (userName) {
            const state: any = this.getState();
            S.util.ajax<J.AddFriendRequest, J.AddFriendResponse>("addFriend", {
                userName
            }, (res: J.AddFriendResponse) => {
                S.util.showMessage(res.message, "New Friend");
            });
        }
        this.close();
    }
}
