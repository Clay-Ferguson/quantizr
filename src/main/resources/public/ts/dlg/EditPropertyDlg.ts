import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Textarea } from "../widget/Textarea";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/*
 * Property Editor Dialog (Edits Node Properties)
 */
export class EditPropertyDlg extends DialogBase {

    propertyNameTextarea: TextField;
    propertyValTextarea: Textarea;
    propSavedFunc: Function;
    editNode: J.NodeInfo;

    constructor(args: any) {
        super("Edit Node Property");
        this.propSavedFunc = args.propSavedFunc;
        this.editNode = args.editNode; 

        this.setChildren([
            new Div(null, null, [
                this.propertyNameTextarea = new TextField("Name"),
                this.propertyValTextarea = new Textarea("Value")
            ]),

            new ButtonBar([
                new Button("Save", this.saveProperty, null, "primary"),
                new Button("Cancel", () => {
                    this.close()
                })
            ])
        ]);
    }

    saveProperty = (): void => {
        let name = this.propertyNameTextarea.getValue();
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
        S.meta64.treeDirty = true;
        this.propSavedFunc();
    }

    init = (): void => {
    }
}
