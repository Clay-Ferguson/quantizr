import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ValHolder } from "../ValHolder";
import { MessageDlg } from "./MessageDlg";

export class ImportCryptoKeyDlg extends DialogBase {
    keyState: ValHolder = new ValHolder();

    constructor(private keyType: string, keyDescription: string) {
        super("Import " + keyDescription, "appModalContMediumWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextArea("Key JWK", { rows: 15 }, this.keyState, null, false),
                new ButtonBar([
                    new Button("Import", this._import, null, "-primary"),
                    new Button("Close", this._close, null, "float-right")
                ], "mt-3")
            ])
        ];
    }

    _import = async () => {
        const keyText = this.keyState.getValue();
        if (!keyText) {
            S.util.showMessage("Enter key text.", "Warning");
            return;
        }
        try {
            let success = false;
            switch (this.keyType) {
                case "asym":
                    success = await S.crypto.importAsymKeyPair(keyText);
                    break;
                case "sym":
                    // not currently used
                    // alert("Feature not available.");
                    break;
                default: break;
            }

            if (!success) {
                S.util.showMessage("Invalid key text", "Warning");
                return;
            }
            else {
                this.close();
                await S.crypto.initKeys(S.quanta.userName, false, true, false, this.keyType);

                const dlg = new MessageDlg("Keys imported successfully", "Keys", () => {
                    window.location.reload();
                }, null, false, 0, null);
                dlg.open();
            }
        }
        catch (e: any) {
            alert("Unable to import key: " + e.message);
        }
    }
}
