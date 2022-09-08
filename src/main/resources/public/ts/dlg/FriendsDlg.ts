import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { FriendsTable } from "../comp/FriendsTable";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ShareToPersonDlg } from "./ShareToPersonDlg";

export interface LS { // Local State
    selections?: Set<string>;
    loading?: boolean;
    friends?: J.FriendInfo[];
}

export class FriendsDlg extends DialogBase {
    selectionValueIntf: ValueIntf;

    constructor(private node: J.NodeInfo, private instantSelect: boolean) {
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
                new ButtonBar([
                    new Button("Ok", this.save, null, "btn-primary"),
                    this.node ? new Button("Enter Username", this.shareToPersonDlg) : null,
                    (state.friends && !this.instantSelect) ? new Button("Choose", () => {
                        this.close();
                    }, null, "btn-primary") : null,
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
        this.close();
    }

    shareToPersonDlg = async () => {
        const dlg = new ShareToPersonDlg(this.node, null);
        await dlg.open();

        if (dlg.userNameState.getValue()) {
            this.selectionValueIntf.setValue(dlg.userNameState.getValue());
        }
    }
}
