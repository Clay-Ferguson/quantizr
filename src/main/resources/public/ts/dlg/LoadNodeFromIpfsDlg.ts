import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState, ValidatorRuleName } from "../ValidatedState";

export class LoadNodeFromIpfsDlg extends DialogBase {

    ipfsPathState: ValidatedState<any> = new ValidatedState<any>("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor() {
        super("Load from IPFS", "app-modal-content-narrow-width");
        this.validatedStates = [this.ipfsPathState];
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new HorizontalLayout([
                    new TextField({ label: "IPFS Path", enter: this.load, val: this.ipfsPathState })
                ]),
                new ButtonBar([
                    new Button("Load", this.load, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    load = async () => {
        if (!this.validate()) {
            return;
        }

        let res = await S.util.ajax<J.LoadNodeFromIpfsRequest, J.LoadNodeFromIpfsResponse>("loadNodeFromIpfs", {
            path: this.ipfsPathState.getValue()
        });

        S.util.showMessage(res.message, "Server Reply", true);
    }
}
