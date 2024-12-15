import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { ConfirmDlg } from "./ConfirmDlg";
import { ImportCryptoKeyDlg } from "./ImportCryptoKeyDlg";

interface LS { // Local State
    keyJson?: string;
}

export class ManageCryptoKeysDlg extends DialogBase {

    constructor() {
        super("Encryption Keys");
    }

    renderDlg(): Comp[] {
        const state: LS = this.getState<LS>();
        return [
            new ButtonBar([
                new Button("New Key", this._newKey),
                // new Button("Remove Key", this.removeKey),
                new Button("Publish Public Key", this._publishKey),
                new Button("Import Key", this._importKey)
            ], "mb-3"),
            new TextContent(state.keyJson, "cryptoKeyTextContent", true),
            new ButtonBar([
                new Button("Close", this._close)
            ], "mt-3")
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
        await S.localDB.removeByKey(S.crypto.STORE_ASYMKEY);
        this.preLoad();
    }

    _newKey = async () => {
        const dlg = new ConfirmDlg("Gernerate new Crypto Key Pair?", "Warning",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (!dlg.yes) return;
        await S.crypto.initKeys(S.quanta.userName, true, true, true, "asym");
        this.preLoad();
    }

    _publishKey = async (): Promise<void> => {
        const dlg = new ConfirmDlg("Publish Public Crypto Key?", "Warning",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (!dlg.yes) return;
        S.crypto.initKeys(S.quanta.userName, false, true, false, "asym");
    }

    _importKey = async (): Promise<void> => {
        const dlg = new ImportCryptoKeyDlg("asym", "Asymmetric Key");
        await dlg.open();
        this.preLoad();
    }

    override async preLoad(): Promise<void> {
        let keyJson: string = null;
        keyJson = await S.crypto.exportAsymKeys();
        this.mergeState<LS>({ keyJson });
    }
}
