import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { FriendsTable } from "../widget/FriendsTable";
import { ValueIntf } from "../Interfaces";
import * as J from "../JavaIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsDlg extends DialogBase {
    
    selectionValueIntf: ValueIntf;
    
    constructor(state: AppState) {
        super("Friends", "app-modal-content-medium-width", null, state);

        this.selectionValueIntf = {
            setValue: (val: string): void => {
                this.mergeState({ selectedName: val });
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
            new Form(null, [
                new FriendsTable(this.getState().friends, this.selectionValueIntf),
                new ButtonBar([
                    new Button("Choose", () => {
                        this.close();
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
}
