import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Textarea } from "../widget/Textarea";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { TextField } from "../widget/TextField";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/*
 * Property Editor Dialog (Edits Node Properties)
 */
export class EditPropertyDlg extends DialogBase {

    propertyNameTextarea: TextField;

    /* name endered by user. We get the results of this dialog by reading this var */
    name: string;

    constructor(private editNode: J.NodeInfo, state: AppState) {
        super("Edit Property Name", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                this.propertyNameTextarea = new TextField("Name"),
            ]),

            new ButtonBar([
                new Button("Save", this.save, null, "btn-primary"),
                new Button("Cancel", () => {
                    this.close()
                })
            ], null, "marginTop")
        ];
    }

    save = (): void => {
        this.name = this.propertyNameTextarea.getValue();

        /* verify first that this property doesn't already exist */
        if (!!S.props.getNodeProp(name, this.editNode)) {
            S.util.showMessage("Property already exists: " + name, "Warning");
            return;
        }

        this.close();
    }
}
