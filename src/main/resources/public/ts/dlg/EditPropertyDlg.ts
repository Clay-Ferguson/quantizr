import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
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

    /* name endered by user. We get the results of this dialog by reading this var */
    name: string;

    constructor(private editNode: J.NodeInfo, state: AppState) {
        super("Edit Property Name", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextField("Name", false, null, null, new CompValueHolder<string>(this, "propName"))
            ]),

            new ButtonBar([
                new Button("Save", this.save, null, "btn-primary"),
                new Button("Cancel", this.close)
            ], null, "marginTop")
        ];
    }

    validate = (): boolean => {
        let valid = true;
        let errors: any = {};
        let state = this.getState();

        if (!state.propName) {
            errors.propNameValidationError = "Cannot be empty.";
            valid = false;
        }
        else {
            errors.propNameValidationError = null;
        }

        this.mergeState(errors);
        return valid;
    }

    renderButtons(): CompIntf {
        return null;
    }

    save = (): void => {
        if (!this.validate()) {
            return;
        }

        this.name = this.getState().propName;

        /* verify first that this property doesn't already exist */
        if (S.props.getNodeProp(name, this.editNode)) {
            S.util.showMessage("Property already exists: " + name, "Warning");
            return;
        }

        this.close();
    }
}
