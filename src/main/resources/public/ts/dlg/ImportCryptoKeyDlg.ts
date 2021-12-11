import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Form } from "../comp/Form";
import { TextArea } from "../comp/TextArea";
import { TextContent } from "../comp/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

export class ImportCryptoKeyDlg extends DialogBase {
    keyState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Import Key Pair", "app-modal-content-medium-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter JWK Key Text"),
                new TextArea("Keys", { rows: 15 }, this.keyState),
                new ButtonBar([
                    new Button("Import", this.import, null, "btn-primary"),
                    new Button("Close", this.close)
                ], "marginTop")
            ])
        ];
    }

    import = async () => {
        // until better validation, just check for empty
        let keyText = this.keyState.getValue();
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
