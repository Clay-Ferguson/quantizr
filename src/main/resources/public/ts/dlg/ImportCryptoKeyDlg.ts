import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { Textarea } from "../widget/Textarea";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ImportCryptoKeyDlg extends DialogBase {

    keyTextField: Textarea;

    constructor(state: AppState) {
        super("Import Key Pair", "app-modal-content-medium-width", false, state);
        this.whenElm((elm: HTMLSelectElement) => {
            this.keyTextField.focus();
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter JWK Key Text"),
                this.keyTextField = new Textarea("Keys", {
                    rows: 15
                }, new CompValueHolder<string>(this, "keyText")),
                new ButtonBar([
                    new Button("Import", this.import, null, "btn-primary"),
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

    import = async () => {
        // until better validation, just check for empty
        let keyText = this.getState().keyText;
        if (!keyText) {
            S.util.showMessage("Enter key text.", "Warning");
            return;
        }
        let success = await S.encryption.importKeyPair(keyText);
        if (!success) {
            S.util.showMessage("Invalid key text", "Warning");
            return;
        }
        this.close();
    }
}
