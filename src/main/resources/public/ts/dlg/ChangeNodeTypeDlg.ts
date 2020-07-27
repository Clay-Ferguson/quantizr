import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Form } from "../widget/Form";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { NodeTypeListBox } from "../widget/NodeTypeListBox";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { ValueIntf } from "../Interfaces";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ChangeNodeTypeDlg extends DialogBase {

    selTypeValueIntf: ValueIntf;
    selCallback: Function = null;
    inlineButton: Button;

    constructor(curType: string, selCallback: Function, state: AppState) {
        super("Set Node Type", "app-modal-content-narrow-width", false, state);
        this.selCallback = selCallback;

        this.selTypeValueIntf = {
            setValue: (val: string): void => {
                this.mergeState({ selType: val });
            },

            getValue: (): string => {
                return this.getState().selType;
            }
        };

        this.mergeState({ selType: curType || "u" });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new NodeTypeListBox(this.selTypeValueIntf, this.appState),
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

    renderButtons(): CompIntf {
        return null;
    }

    setNodeType = (): void => {
        //console.log("accepting TypeSelected: " + this.getState().selType);
        this.selCallback(this.getState().selType);
    }
}
