import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Selection } from "../comp/core/Selection";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { ConfirmDlg } from "./ConfirmDlg";
import { ImportCryptoKeyDlg } from "./ImportCryptoKeyDlg";

interface LS { // Local State
    keyType?: string;
    keyJson?: string;
}

export class ManageCryptoKeysDlg extends DialogBase {

    constructor() {
        super("Security Keys");
        this.mergeState({ keyType: "sig" });
    }

    renderDlg(): Comp[] {
        const state: LS = this.getState<LS>();
        return [
            new Selection(null, "Select Key", [
                { key: "sig", val: this.getKeyTypeName("sig") }, // STORE_SIGKEY
                { key: "asym", val: this.getKeyTypeName("asym") } // STORE_ASYMKEY

                // currently not sing SYMKEY for anything.
                // { key: "sym", val: this.getKeyTypeName("sym") } // STORE_SYMKEY
            ], "selectKeyTypeDropDown", null, {
                setValue: (val: string) => {
                    this.mergeState<LS>({ keyType: val, keyJson: "Loading..." });
                    setTimeout(() => { this.preLoad(); }, 500);
                },
                getValue: (): string => this.getState<LS>().keyType
            }),
            new ButtonBar([
                new Button("New Key", this._newKey),
                // new Button("Remove Key", this.removeKey),
                state.keyType !== "sym" ? new Button("Publish Public Key", this._publishKey) : null,
                new Button("Import Key", this._importKey)
            ], "marginBottom"),
            new TextContent(state.keyJson, "cryptoKeyTextContent", true),
            new ButtonBar([
                new Button("Close", this._close)
            ], "marginTop")
        ];
    }

    /* UNUSED: but do not delete. This is not a good usable feature because we regenerate keys as
     needed. I wrote this as part of testing crypto stuff locally, before I remembered that not only
     do we generate keys automaitcally I also can't even test this on localhost because browsers
     require `https` and I don't have a way do do https locally currently. So, long story short, I
     might end up needing this method in the future */
    removeKey = async () => {
        const dlg = new ConfirmDlg("Remove Crypto Key?", "Warning",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (!dlg.yes) return;
        const state: LS = this.getState<LS>();
        switch (state.keyType) {
            case "sig":
                await S.localDB.removeByKey(S.crypto.STORE_SIGKEY);
                break;
            case "asym":
                await S.localDB.removeByKey(S.crypto.STORE_ASYMKEY);
                break;
            case "sym":
                await S.localDB.removeByKey(S.crypto.STORE_SYMKEY);
                break;
            default: break;
        }
        this.preLoad();
    }

    _newKey = async () => {
        const dlg = new ConfirmDlg("Gernerate new Crypto Key Pair?", "Warning",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (!dlg.yes) return;
        const state: LS = this.getState<LS>();
        await S.crypto.initKeys(S.quanta.userName, true, true, true, state.keyType);
        this.preLoad();
    }

    _publishKey = async (): Promise<void> => {
        const dlg = new ConfirmDlg("Publish Public Crypto Key?", "Warning",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (!dlg.yes) return;
        const state: LS = this.getState<LS>();
        S.crypto.initKeys(S.quanta.userName, false, true, false, state.keyType);
    }

    _importKey = async (): Promise<void> => {
        const state: LS = this.getState<LS>();
        const dlg = new ImportCryptoKeyDlg(state.keyType, this.getKeyTypeName(state.keyType));
        await dlg.open();
        this.preLoad();
    }

    getKeyTypeName(abbrev: string): string {
        switch (abbrev) {
            case "sig": return "Signature Key";
            case "asym": return "Asymmetric Key";
            case "sym": return "Symmetric Key";
            default: break;
        }
    }

    override async preLoad(): Promise<void> {
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
                keyJson = await S.crypto.exportSymKey();
                this.mergeState<LS>({ keyJson });
                break;
            default:
                this.mergeState<LS>({ keyJson: "" });
        }
    }
}
