import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Form } from "../comp/core/Form";
import { FriendsTable } from "../comp/FriendsTable";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import * as J from "../JavaIntf";
import { S } from "../Singletons";

interface LS {
    selectedName?: string;
    loading?: boolean;
    friends?: J.FriendInfo[];
}

export class FriendsDlg extends DialogBase {

    selectionValueIntf: ValueIntf;

    constructor(state: AppState, private instantSelect: boolean) {
        super("Friends", "app-modal-content-medium-width", null, state);

        this.selectionValueIntf = {
            setValue: (val: string): void => {
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
            let res: J.GetFriendsResponse = await S.util.ajax<J.GetFriendsRequest, J.GetFriendsResponse>("getFriends");
            this.mergeState<LS>({
                friends: res.friends,
                loading: false
            });
        })();
    }

    renderDlg(): CompIntf[] {
        let message = null;
        if (this.getState<LS>().loading) {
            message = "Loading...";
        }
        else if (!this.getState<LS>().friends) {
            message = "You haven't yet added any friends yet!";
        }

        return [
            new Form(null, [
                !this.getState<LS>().friends ? new Div(message)
                    : new FriendsTable(this.getState<LS>().friends, this.selectionValueIntf),
                new ButtonBar([
                    (this.getState<LS>().friends && !this.instantSelect) ? new Button("Choose", () => {
                        this.close();
                    }, null, "btn-primary") : null,
                    new Button("Close", this.close)
                ], "marginTop")
            ])
        ];
    }
}
