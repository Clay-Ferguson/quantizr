import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Form } from "../comp/core/Form";
import { FriendsTable } from "../comp/FriendsTable";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ShareToPersonDlg } from "./ShareToPersonDlg";

interface LS { // Local State
    selectedName?: string;
    loading?: boolean;
    friends?: J.FriendInfo[];
}

export class FriendsDlg extends DialogBase {

    selectionValueIntf: ValueIntf;

    constructor(private node: J.NodeInfo, state: AppState, private instantSelect: boolean) {
        super("Friends", "app-modal-content-medium-width", null, state);

        this.selectionValueIntf = {
            setValue: (val: string) => {
                this.mergeState<LS>({ selectedName: val });
                if (this.instantSelect) {
                    // this timeout IS required for correct state management, but is also ideal
                    // so user has a chance to see their selection get highlighted.
                    setTimeout(
                        this.close, 500);
                }
            },

            getValue: (): string => {
                return this.getState<LS>().selectedName;
            }
        };

        this.mergeState<LS>({
            loading: true
        });

        (async () => {
            let res = await S.util.ajax<J.GetFriendsRequest, J.GetFriendsResponse>("getFriends");
            this.mergeState<LS>({
                friends: res.friends,
                loading: false
            });
        })();
    }

    renderDlg(): CompIntf[] {
        let state: LS = this.getState();
        let message = null;
        if (state.loading) {
            message = "Loading...";
        }
        else if (!state.friends || state.friends.length === 0) {
            message = "Once you add some friends you can pick from a list here, but for now you can use the button below to find people by name.";
        }

        return [
            new Form(null, [
                message ? new Div(message)
                    : new FriendsTable(state.friends, this.selectionValueIntf),
                new ButtonBar([
                    this.node ? new Button("Add by User Name", this.shareToPersonDlg, null, "btn-primary") : null,
                    (state.friends && !this.instantSelect) ? new Button("Choose", () => {
                        this.close();
                    }, null, "btn-primary") : null,
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop"),
                new Clearfix() // required in case only ButtonBar children are float-end, which would break layout
            ])
        ];
    }

    shareToPersonDlg = async () => {
        let dlg = new ShareToPersonDlg(this.node, null, this.appState);
        await dlg.open();

        if (dlg.userNameState.getValue()) {
            this.selectionValueIntf.setValue(dlg.userNameState.getValue());
        }

        // this promise currently isn't needed
        return null;
    }
}
