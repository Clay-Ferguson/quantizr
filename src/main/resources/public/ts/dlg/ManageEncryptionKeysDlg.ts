import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

interface LS { // Local State
    keyJson: string;
}

export class ManageEncryptionKeysDlg extends DialogBase {

    constructor() {
        super("Encryption Keys");
    }

    renderDlg(): CompIntf[] {
        return [
            new TextContent(this.getState<LS>().keyJson, "tallTextContent", true),
            new ButtonBar([
                new Button("Close", this.close)
            ], "marginTop")
        ];
    }

    async preLoad(): Promise<void> {
        const keyJson: string = await S.crypto.exportKeys();
        this.mergeState<LS>({ keyJson });
    }
}
