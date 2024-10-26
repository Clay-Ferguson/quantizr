import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { Validator } from "../Validator";

export interface LS { // Local State
    amount: string
}

/* When this dialog returns the caller should be able to either get one property name from
nameState, or else get the list of properties from LS.selections, depending on which user has
selected. */
export class AddCreditDlg extends DialogBase {
    amtState: Validator = new Validator("");

    constructor() {
        super("Add Credit", "appModalContMediumWidth");
        this.mergeState<LS>({ amount: null });
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, { className: "marginBottom" }, [
                new TextField({ label: "Amount", val: this.amtState }),
                new ButtonBar([
                    new Button("Add Credit", this._close, null, "-primary"),
                    new Button("Cancel", this._close)
                ], "mt-3")
            ])
        ];
    }

    cancel = () => {
        this.amtState.setValue(null);
    }
}
