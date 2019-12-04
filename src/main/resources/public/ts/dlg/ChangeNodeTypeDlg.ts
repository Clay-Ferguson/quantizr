console.log("CreateNodeDlg.ts");

import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Form } from "../widget/Form";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { NodeTypeListBox } from "../widget/NodeTypeListBox";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ChangeNodeTypeDlg extends DialogBase {

    selType: string = "nt:unstructured";
    selCallback: Function = null;
    inlineButton: Button;
    nodeTypeListBox: NodeTypeListBox;

    constructor(selCallback : Function) {
        super("Set Node Type");
        
        this.selCallback = selCallback;
        this.setChildren([
            new Form(null, [
                //todo-p2: need to make this default to the right type.
                this.nodeTypeListBox = new NodeTypeListBox(this.selType, true),
                new ButtonBar([
                    new Button("Set Type", () => {
                        this.setNodeType();
                        this.close();
                    }),
                    new Button("Cancel", () =>{
                        this.close();
                    })
                ])
            ])
        ]);
    }

    setNodeType = (): void => {
        this.selCallback(this.nodeTypeListBox.selType);
    }
}
