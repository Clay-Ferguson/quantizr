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

export class AskForEmail extends DialogBase {
    static emailState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);

    constructor() {
        super("Send To Email Address", "appModalContNarrowWidth");
        this.mergeState<LS>({ user: "" });
        this.validatedStates = [AskForEmail.emailState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextContent("Enter email to send to:"),
                new TextField({ label: "Email", val: AskForEmail.emailState }),
                new ButtonBar([
                    new Button("Ok", this.acceptEmail, null, "-primary"),
                    new Button("Close", this._close, null, "-secondary tw-float-right")
                ], "marginTop")
            ])
        ];
    }

    acceptEmail = async () => {
        if (!this.validate()) {
            return;
        }
        this.close();
    }
}
