import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { EmojiPicker } from "../comp/EmojiPicker";
import { Form } from "../comp/Form";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    selectedEmoji: string;
}

export class EmojiPickerDlg extends DialogBase {

    selectionValueIntf: ValueIntf;

    constructor(state: AppState) {
        super("Emojis", "app-modal-content-narrow-width", null, state);

        this.selectionValueIntf = {
            setValue: (val: string): void => {
                this.mergeState<LS>({ selectedEmoji: val });
                this.close();
            },

            getValue: (): string => {
                return this.getState<LS>().selectedEmoji;
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
