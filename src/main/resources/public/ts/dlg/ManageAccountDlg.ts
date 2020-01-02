import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ManageAccountDlg extends DialogBase {

    constructor() {
        super("Manage Account");
        
        this.setChildren([
            new ButtonBar([
                new Button("Close Account", this.closeAccount),
                new Button("Cancel", () => {
                    this.close();
                })
            ])
        ]);
    }

    closeAccount = (): void => {
        S.user.closeAccount();
        this.close();
    }
}
