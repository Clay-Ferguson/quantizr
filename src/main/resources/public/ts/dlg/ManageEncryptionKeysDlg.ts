import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

interface LS { // Local State
    asymKey: string;
    symKey: string;
    sigKey: string;
}

export class ManageEncryptionKeysDlg extends DialogBase {

    constructor() {
        super("Encryption Keys (JWK Format)");
    }

    renderDlg(): CompIntf[] {
        return [
            new Div("Asymmetric Key "),
            new TextContent(this.getState<LS>().asymKey, "cryptoKeyTextContent", true),
            new Div("Symmtric Key"),
            new TextContent(this.getState<LS>().symKey, "cryptoKeyTextContent", true),
            new Div("Signature Key"),
            new TextContent(this.getState<LS>().sigKey, "cryptoKeyTextContent", true),
            new ButtonBar([
                new Button("Close", this.close)
            ], "marginTop")
        ];
    }

    async preLoad(): Promise<void> {
        const asymKey: string = await S.crypto.exportAsymKeys();
        const symKey: string = await S.crypto.exportSymKeys();
        const sigKey: string = await S.crypto.exportSigKeys();

        this.mergeState<LS>({ asymKey, symKey, sigKey });
    }
}
