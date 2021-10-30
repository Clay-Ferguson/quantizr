import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ManageEncryptionKeysDlg extends DialogBase {

    constructor(state: AppState) {
        super("Encryption Keys", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new TextContent(this.getState().keyJson, "tallTextContent", true),
            new ButtonBar([
                new Button("Close", this.close)
            ], "marginTop")
        ];
    }

    preLoad(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let keyJson: string = await S.encryption.exportKeys();
            this.mergeState({ keyJson });
            resolve();
        });
    }
}
