import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextContent } from "../widget/TextContent";
import { DialogBase } from "../DialogBase";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

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
                new Button("Close", () => {
                    this.close();
                })
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    //@Override
    preLoad(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let keyJson: string = await S.encryption.exportKeys();
            this.mergeState({keyJson});
            resolve();
        });
    }
}
