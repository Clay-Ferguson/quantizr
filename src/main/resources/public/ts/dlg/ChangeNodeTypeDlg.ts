import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Form } from "../widget/Form";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { NodeTypeListBox } from "../widget/NodeTypeListBox";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ChangeNodeTypeDlg extends DialogBase {

    selType: string = "u";
    selCallback: Function = null;
    inlineButton: Button;
    nodeTypeListBox: NodeTypeListBox;

    constructor(selCallback : Function, state: AppState) {
        super("Set Node Type", "app-modal-content-narrow-width", false, state);
        this.selCallback = selCallback;
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                //todo-p2: need to make this default to the right type.
                this.nodeTypeListBox = new NodeTypeListBox(this.selType, true),
                new ButtonBar([
                    new Button("Set Type", () => {
                        this.setNodeType();
                        this.close();
                    }, null, "btn-primary"),
                    new Button("Cancel", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    setNodeType = (): void => {
        this.selCallback(this.nodeTypeListBox.selType);
    }
}
