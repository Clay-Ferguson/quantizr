import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { FriendsTable } from "../widget/FriendsTable";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsDlg extends DialogBase {
    friendsTable: FriendsTable;
    
    constructor(state: AppState) {
        super("Friends", "app-modal-content-medium-width", null, state);
    }

    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                this.friendsTable = new FriendsTable(null),
                new ButtonBar([
                    new Button("Choose", () => {

                    }, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
        this.reload();
        return children;
    }

    reload = (): void => {
        S.util.ajax<J.GetFriendsRequest, J.GetFriendsResponse>("getFriends", {
        },  (res: J.GetFriendsResponse): void => {
            this.friendsTable.mergeState({friends: res.friends});
        });
    }
}
