import Picker, { EmojiClickData } from "emoji-picker-react";
import { ValueIntf } from "../../Interfaces";
import { Comp } from "../base/Comp";

export class EmojiPicker extends Comp {

    constructor(private selectionValueIntf: ValueIntf) {
        super();
        this.attribs.pickerStyle = { width: "100%", marginBottom: "16px" };
        this.attribs.onEmojiClick = (emojiData: EmojiClickData, _event: MouseEvent) => {
            // console.log("emoji: & #x" + emojiData.unified + "; &#x" + emojiData.unified + "; ");
            this.selectionValueIntf.setValue(emojiData.emoji);
        };
        this.tag = Picker;
    }
}
