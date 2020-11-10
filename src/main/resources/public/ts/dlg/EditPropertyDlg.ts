import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/*
 * Property Editor Dialog (Edits Node Properties)
 */
export class EditPropertyDlg extends DialogBase {

    nameState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private editNode: J.NodeInfo, state: AppState) {
        super("Edit Property Name", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextField("Name", false, null, null, false, this.nameState)
            ]),

            new ButtonBar([
                new Button("Save", this.save, null, "btn-primary"),
                new Button("Cancel", this.close)
            ], null, "marginTop")
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
}
