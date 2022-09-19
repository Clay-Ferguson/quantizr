import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Selection } from "../comp/core/Selection";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ConfirmDlg } from "./ConfirmDlg";
import { ImportCryptoKeyDlg } from "./ImportCryptoKeyDlg";

interface LS { // Local State
    keyType?: string;
    keyJson?: string;
}

export class ManageEncryptionKeysDlg extends DialogBase {

    constructor() {
        super("Encryption Keys");
        this.mergeState({ keyType: "sig" });
    }

    renderDlg(): CompIntf[] {
        const state: LS = this.getState<LS>();
        return [
            new Selection(null, "Key Type", [
                { key: "sig", val: this.getKeyTypeName("sig") },
                { key: "asym", val: this.getKeyTypeName("asym") },
                { key: "sym", val: this.getKeyTypeName("sym") }
            ], "selectKeyTypeDropDown", null, {
                setValue: (val: string) => {
                    console.log("Key Type: " + val);
                    this.mergeState<LS>({ keyType: val, keyJson: "Loading..." });
                    setTimeout(() => { this.preLoad(); }, 500);
                },
                getValue: (): string => this.getState<LS>().keyType
            }),
            new ButtonBar([
                new Button("New Key", this.newKey),
                state.keyType !== "sym" ? new Button("Publish Public Key", this.publishKey) : null,
                new Button("Import Key", this.importKey)
            ], "marginBottom"),
            new TextContent(state.keyJson, "cryptoKeyTextContent", true),
            new ButtonBar([
                new Button("Close", this.close)
            ], "marginTop")
        ];
    }

    newKey = async () => {
        const dlg = new ConfirmDlg("Gernerate new Crypto Keys?", "Warning",
            "btn-danger", "alert alert-danger");
        await dlg.open();
        if (!dlg.yes) return;
        const state: LS = this.getState<LS>();
        S.crypto.initKeys(S.quanta.userName, true, true, true, state.keyType);
    }

    publishKey = async () => {
        const dlg = new ConfirmDlg("Publish Public Crypto Key?", "Warning",
            "btn-danger", "alert alert-danger");
        await dlg.open();
        if (!dlg.yes) return;
        const state: LS = this.getState<LS>();
        S.crypto.initKeys(S.quanta.userName, false, true, false, state.keyType);
    }

    importKey = (): void => {
        const state: LS = this.getState<LS>();
        new ImportCryptoKeyDlg(state.keyType, this.getKeyTypeName(state.keyType)).open();
    }

    getKeyTypeName = (abbrev: string): string => {
        switch (abbrev) {
            case "sig": return "Signature Key";
            case "asym": return "Asymmetric Key";
            case "sym": return "Symmetric Key";
            default: break;
        }
    }

    async preLoad(): Promise<void> {
        const state: LS = this.getState<LS>();
        let keyJson: string = null;
        switch (state.keyType) {
            case "sig":
                keyJson = await S.crypto.exportSigKeys();
                this.mergeState<LS>({ keyJson });
                break;
            case "asym":
                keyJson = await S.crypto.exportAsymKeys();
                this.mergeState<LS>({ keyJson });
                break;
            case "sym":
                keyJson = await S.crypto.exportSymKeys();
                this.mergeState<LS>({ keyJson });
                break;
            default:
                this.mergeState<LS>({ keyJson: "" });
        }
    }
}
