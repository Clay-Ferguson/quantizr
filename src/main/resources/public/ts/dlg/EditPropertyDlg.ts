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
import { CompValueHolder } from "../CompValueHolder";

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
        super("Edit Property Name", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextField("Name", null, false, null, new CompValueHolder<string>(this, "propName")),
            ]),

            new ButtonBar([
                new Button("Save", this.save, null, "btn-primary"),
                new Button("Cancel", () => {
                    this.close()
                })
            ], null, "marginTop")
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    save = (): void => {
        this.name = this.getState().propName;

        /* verify first that this property doesn't already exist */
        if (!!S.props.getNodeProp(name, this.editNode)) {
            S.util.showMessage("Property already exists: " + name, "Warning");
            return;
        }

        this.close();
    }
}
