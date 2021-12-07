import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { TextContent } from "../comp/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    keyJson: string;
}

export class ManageEncryptionKeysDlg extends DialogBase {

    constructor(state: AppState) {
        super("Encryption Keys", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new TextContent(this.getState<LS>().keyJson, "tallTextContent", true),
            new ButtonBar([
                new Button("Close", this.close)
            ], "marginTop")
        ];
    }

    async preLoad(): Promise<void> {
        let keyJson: string = await S.encryption.exportKeys();
        this.mergeState<LS>({ keyJson });
    }
}
