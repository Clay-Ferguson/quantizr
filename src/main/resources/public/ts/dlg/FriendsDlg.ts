import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { FriendsTable } from "../comp/FriendsTable";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { FriendsDlgState as LS } from "./FriendsDlgState";

export class FriendsDlg extends DialogBase {
    userNameState: Validator = new Validator("");

    constructor() {
        super("Friends", "app-modal-content-medium-width");

        this.mergeState<LS>({
            selections: new Set<string>(),
            loading: true
        });

        (async () => {
            const res = await S.rpcUtil.rpc<J.GetFriendsRequest, J.GetFriendsResponse>("getFriends");
            this.mergeState<LS>({
                friends: res.friends,
                loading: false
            });
        })();
    }

    renderDlg(): CompIntf[] {
        const state: LS = this.getState();
        let message = null;
        if (state.loading) {
            message = "Loading...";
        }
        else if (!state.friends || state.friends.length === 0) {
            message = "Once you add some friends you can pick from a list here, but for now you can use the button below to find people by name.";
        }

        return [
            new Div(null, null, [
                message ? new Div(message)
                    : new FriendsTable(state.friends, this),
                new TextField({ label: "User Names (comma separated)", val: this.userNameState }),
                new ButtonBar([
                    new Button("Ok", this.save, null, "btn-primary"),
                    new Button("Cancel", this.cancel, null, "btn-secondary float-end")
                ], "marginTop"),
                new Clearfix() // required in case only ButtonBar children are float-end, which would break layout
            ])
        ];
    }

    cancel = () => {
        this.mergeState<LS>({
            selections: new Set<string>()
        });
        this.close();
    }

    save = () => {
        const usersText = this.userNameState.getValue();
        if (usersText) {
            const users: string[] = usersText.split(",");
            const state = this.getState();
            for (const user of users) {
                state.selections.add(user);
            }
            this.mergeState<LS>(state);
        }
        this.close();
    }
}
