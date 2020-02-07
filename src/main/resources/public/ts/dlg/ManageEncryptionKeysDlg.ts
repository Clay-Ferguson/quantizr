import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextContent } from "../widget/TextContent";
import { DialogBase } from "../DialogBase";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";

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
                new Button("Generate Keys", async () => {
                    await S.encryption.initKeys(true);
                    this.refreshKeyInfo();
                }),
                new Button("Test Keys", async () => {
                    let result = await S.encryption.asymKeyTest();
                    S.util.showMessage(result, true);
                }),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ]);

        this.refreshKeyInfo();   
    }

    refreshKeyInfo = () => {
        this.textContent.whenElm(async (elm: any) => {
            let keyJson: string = await S.encryption.exportKeys();
            this.textContent.setText(keyJson);
        });   
    }
}
