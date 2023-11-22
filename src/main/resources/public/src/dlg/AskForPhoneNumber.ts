import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { Validator, ValidatorRuleName } from "../Validator";

interface LS { // Local State
    user: string;
}

export class AskForPhoneNumber extends DialogBase {
    static phoneState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);

    constructor() {
        super("Send To Phone Number", "appModalContNarrowWidth");
        this.mergeState<LS>({ user: "" });
        this.validatedStates = [AskForPhoneNumber.phoneState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextContent("Enter phone number to send to:"),
                new TextField({ label: "Phone Number", val: AskForPhoneNumber.phoneState }),
                new ButtonBar([
                    new Button("Ok", this.acceptPhone, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    acceptPhone = async () => {
        if (!this.validate()) {
            return;
        }
        this.close();
    }
}
