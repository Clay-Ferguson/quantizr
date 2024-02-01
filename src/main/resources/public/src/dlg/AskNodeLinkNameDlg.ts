import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { Validator, ValidatorRuleName } from "../Validator";

export class AskNodeLinkNameDlg extends DialogBase {
    public nameEntered: string;

    static nameState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor() {
        super("RDF Predicate", "appModalContNarrowWidth");
        if (AskNodeLinkNameDlg.nameState.getValue() === "") {
            AskNodeLinkNameDlg.nameState.setValue("link");
        }
        this.validatedStates = [AskNodeLinkNameDlg.nameState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextField({ label: "Predicate", val: AskNodeLinkNameDlg.nameState })
            ]),
            new ButtonBar([
                new Button("Ok", this.save, null, "btn-primary"),
                new Button("Cancel", this.close)
            ], "marginTop")
        ];
    }

    save = () => {
        if (!this.validate()) {
            return;
        }
        this.nameEntered = AskNodeLinkNameDlg.nameState.getValue();
        this.close();
    }
}
