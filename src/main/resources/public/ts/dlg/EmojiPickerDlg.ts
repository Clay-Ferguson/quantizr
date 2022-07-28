import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { EmojiPicker } from "../comp/core/EmojiPicker";
import { Form } from "../comp/core/Form";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";

interface LS { // Local State
    selectedEmoji: string;
}

export class EmojiPickerDlg extends DialogBase {
    selectionValueIntf: ValueIntf;

    constructor() {
        super("Emojis", "app-modal-content-narrow-width");

        this.selectionValueIntf = {
            setValue: (val: string) => {
                this.mergeState<LS>({ selectedEmoji: val });
                this.close();
            },
            getValue: (): string => this.getState<LS>().selectedEmoji
        };
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new EmojiPicker(this.selectionValueIntf),
                new ButtonBar([
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }
}
