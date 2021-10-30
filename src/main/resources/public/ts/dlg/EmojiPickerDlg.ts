import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { EmojiPicker } from "../widget/EmojiPicker";
import { Form } from "../widget/Form";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EmojiPickerDlg extends DialogBase {

    selectionValueIntf: ValueIntf;

    constructor(state: AppState) {
        super("Emojis", "app-modal-content-narrow-width", null, state);

        this.selectionValueIntf = {
            setValue: (val: string): void => {
                this.mergeState({ selectedEmoji: val });
                this.close();
            },

            getValue: (): string => {
                return this.getState().selectedEmoji;
            }
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
