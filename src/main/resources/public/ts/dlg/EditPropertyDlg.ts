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
    propertyValTextarea: Textarea;

    constructor(private editNode: J.NodeInfo, private propSavedFunc: Function, state: AppState) {
        super("Edit Node Property", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                this.propertyNameTextarea = new TextField("Name"),
                this.propertyValTextarea = new Textarea("Value")
            ]),

            new ButtonBar([
                new Button("Save", this.saveProperty, null, "btn-primary"),
                new Button("Cancel", () => {
                    this.close()
                })
            ], null, "marginTop")
        ];
    }

    saveProperty = (): void => {
        let name = this.propertyNameTextarea.getValue();

        /* verify first that this property doesn't already exist */
        if (!!S.props.getNodeProp(name, this.editNode)) {
            S.util.showMessage("Property already exists: " + name, "Warning");
            return;
        }

        let val = this.propertyValTextarea.getValue();

        var postData = {
            nodeId: this.editNode.id,
            propertyName: name,
            propertyValue: val
        };
        S.util.ajax<J.SavePropertyRequest, J.SavePropertyResponse>("saveProperty", postData, this.savePropertyResponse);
    }

    savePropertyResponse = (res: J.SavePropertyResponse): void => {
        S.util.checkSuccess("Save properties", res);
        this.close();

        if (!this.editNode.properties) {
            this.editNode.properties = [];
        }

        this.editNode.properties.push(res.propertySaved);
        this.propSavedFunc();
    }
}
