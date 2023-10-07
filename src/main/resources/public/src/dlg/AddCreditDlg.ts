import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Divc } from "../comp/core/Divc";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { Validator } from "../Validator";

export interface LS { // Local State
    amount: string
}

/* When this dialog returns the caller should be able to either get one property name from nameState, or
else get the list of properties from LS.selections, depending on which user has selected. */
export class AddCreditDlg extends DialogBase {
    amtState: Validator = new Validator("");

    constructor() {
        super("Add Credit", "appModalContMediumWidth");
        this.mergeState<LS>({ amount: null });
    }

    renderDlg(): CompIntf[] {
        return [
            new Divc({ className: "marginBottom" }, [
                new TextField({ label: "Amount", val: this.amtState }),
                new ButtonBar([
                    new Button("Add Credit", this.close, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    cancel = () => {
        this.amtState.setValue(null);
    }
}
