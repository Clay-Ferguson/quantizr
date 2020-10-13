import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Form } from "../widget/Form";
import { VerticalLayout } from "../widget/VerticalLayout";

/**
 * Dialog to let user configure encryption for a node. Output is stored in 'this.encrypted', don't get it from the state
 * because the user might click cancel.
 */
export class EncryptionDlg extends DialogBase {

    constructor(public encrypted: boolean, state: AppState) {
        super("Node Encryption", "app-modal-content-medium-width", false, state);
        this.mergeState({ encrypted });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new VerticalLayout([
                    new Checkbox("Encrypt Content", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ encrypted: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().encrypted;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Save", () => {
                        this.encrypted = this.getState().encrypted;
                        this.close();
                    }, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }
}
