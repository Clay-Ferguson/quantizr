import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Div } from "../comp/Div";
import { TextField } from "../comp/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

/*
 * Property Editor Dialog (Edits Node Properties)
 */
export class EditPropertyDlg extends DialogBase {

    nameState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private editNode: J.NodeInfo, state: AppState) {
        super("Property Name", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextField("Name", false, null, null, false, this.nameState)
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.nameState.getValue()) {
            this.nameState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.nameState.setError(null);
        }
        return valid;
    }

    save = (): void => {
        if (!this.validate()) {
            return;
        }
        let name = this.nameState.getValue();

        /* verify first that this property doesn't already exist */
        if (S.props.getNodeProp(name, this.editNode)) {
            S.util.showMessage("Property already exists: " + name, "Warning");
            return;
        }
        this.close();
    }

    renderButtons(): CompIntf {
        return new ButtonBar([
            new Button("Save", this.save, null, "btn-primary"),
            new Button("Cancel", this.close)
        ], "marginTop");
    }
}
