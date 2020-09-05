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
import { Form } from "../widget/Form";
import { FriendsTable } from "../widget/FriendsTable";

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
