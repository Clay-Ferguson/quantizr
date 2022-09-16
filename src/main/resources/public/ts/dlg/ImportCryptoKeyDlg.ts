import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { MessageDlg } from "./MessageDlg";

export class ImportCryptoKeyDlg extends DialogBase {
    asymKeyState: Validator = new Validator();
    symKeyState: Validator = new Validator();
    sigKeyState: Validator = new Validator();

    constructor() {
        super("Import Key Pair", "app-modal-content-medium-width");
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                // todo-1: currently only supporting import of sigKey
                // new TextArea("Asymmetric Keys", { rows: 15 }, this.asymKeyState, null, false),
                // new TextArea("Symmetric Key", { rows: 15 }, this.symKeyState, null, false),
                new TextArea("Signature Key JWK", { rows: 15 }, this.sigKeyState, null, false),
                new ButtonBar([
                    new Button("Import", this.import, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    import = async () => {
        // until better validation, just check for empty
        const keyText = this.sigKeyState.getValue();
        if (!keyText) {
            S.util.showMessage("Enter key text.", "Warning");
            return;
        }
        try {
            const success = await S.crypto.importSigKeyPair(keyText);
            if (!success) {
                S.util.showMessage("Invalid key text", "Warning");
                return;
            }
            else {
                this.close();
                await S.crypto.initKeys(S.quanta.userName, false, true, false);

                const dlg = new MessageDlg("Keys imported successfully! App will refresh.", "Keys", () => {
                    window.location.reload();
                }, null, false, 0, null);
                dlg.open();
            }
        }
        catch (e) {
            alert("Unable to import key: " + e.message);
        }
    }
}
