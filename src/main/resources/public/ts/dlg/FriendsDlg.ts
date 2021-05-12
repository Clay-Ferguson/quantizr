import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { FriendsTable } from "../widget/FriendsTable";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsDlg extends DialogBase {

    selectionValueIntf: ValueIntf;

    constructor(state: AppState, private instantSelect: boolean) {
        super("Friends", "app-modal-content-medium-width", null, state);

        this.selectionValueIntf = {
            setValue: (val: string): void => {
                this.mergeState({ selectedName: val });
                if (this.instantSelect) {
                    // this timeout IS required for correct state management, but is also ideal
                    // so user has a chance to see their selection get highlighted.
                    setTimeout(
                        this.close, 500);
                }
            },

            getValue: (): string => {
                return this.getState().selectedName;
            }
        };

        S.util.ajax<J.GetFriendsRequest, J.GetFriendsResponse>("getFriends", {
        }, (res: J.GetFriendsResponse): void => {
            this.mergeState({
                friends: res.friends
            });
        });
    }

    renderDlg(): CompIntf[] {
        return [
            // I hacked this to make it just tell the user they have no friends and
            // show juse the close button but we could do something much better here.
            new Form(null, [
                !this.getState().friends ? new Div("You haven't yet added any friends yet!")
                    : new FriendsTable(this.getState().friends, this.selectionValueIntf),
                new ButtonBar([
                    (this.getState().friends && !this.instantSelect) ? new Button("Choose", () => {
                        this.close();
                    }, null, "btn-primary") : null,
                    new Button("Close", this.close)
                ])
            ])
        ];
    }
}
