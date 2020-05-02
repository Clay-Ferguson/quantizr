import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextContent } from "../widget/TextContent";
import { DialogBase } from "../DialogBase";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ManageEncryptionKeysDlg extends DialogBase {

    textContent: TextContent;

    constructor() {
        super("Encryption Keys");

        this.setChildren([
            this.textContent = new TextContent("Getting key info...", "tallTextContent", true),
            new ButtonBar([
                //both of these operations need some kind of confirmation dialog to come up after
                new Button("Generate New Keys", async () => {
                    await S.encryption.initKeys(true);
                    this.refreshKeyInfo();
                }),
                new Button("Re-Publish Keys", async () => {
                    await S.encryption.initKeys(false, true);
                }),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ]);

    this.refreshKeyInfo();
    }

    refreshKeyInfo = async () => {
        let keyJson: string = await S.encryption.exportKeys();
        this.textContent.setText(keyJson);
    }
}
