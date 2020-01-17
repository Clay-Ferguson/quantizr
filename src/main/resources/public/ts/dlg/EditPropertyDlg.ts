import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import { EditNodeDlg } from "./EditNodeDlg";
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

    propertyNameTextarea: Textarea;
    propertyValTextarea: Textarea;
    private editNodeDlg: EditNodeDlg;
    editNode: I.NodeInfo;

    constructor(args: any) {
        super("Edit Node Property");
        this.editNodeDlg = args.editNodeDlg;
        this.editNode = args.editNode; 

        this.setChildren([
            new Div(null, null, [
                this.propertyNameTextarea = new TextField({
                    "placeholder": "Enter property name",
                    "label": "Name"
                }),
                this.propertyValTextarea = new Textarea({
                    "placeholder": "Enter property text",
                    "label": "Value"
                })
            ]),

            new ButtonBar([
                new Button("Save", this.saveProperty),
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
        S.util.ajax<I.SavePropertyRequest, I.SavePropertyResponse>("saveProperty", postData, this.savePropertyResponse);
    }

    savePropertyResponse = (res: I.SavePropertyResponse): void => {
        S.util.checkSuccess("Save properties", res);
        this.close();

        if (!this.editNode.properties) {
            this.editNode.properties = [];
        }

        this.editNode.properties.push(res.propertySaved);
        S.meta64.treeDirty = true;

        //todo-0: this is a super-ugly tight-coupling. change to something better.
        this.editNodeDlg.rebuildDlg(); 
    }

    init = (): void => {
    }
}
