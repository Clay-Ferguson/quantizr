import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

export class LoadNodeFromIpfsDlg extends DialogBase {

    ipfsPathState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Load from IPFS", "app-modal-content-narrow-width", false);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
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

    validate = (): boolean => {
        let valid = true;

        if (!this.ipfsPathState.getValue()) {
            this.ipfsPathState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.ipfsPathState.setError(null);
        }
        return valid;
    }

    load = async () => {
        if (!this.validate()) {
            return;
        }
        let path = this.ipfsPathState.getValue();

        let res = await S.util.ajax<J.LoadNodeFromIpfsRequest, J.LoadNodeFromIpfsResponse>("loadNodeFromIpfs", {
            path
        });

        S.util.showMessage(res.message, "Server Reply", true);
    }
}
