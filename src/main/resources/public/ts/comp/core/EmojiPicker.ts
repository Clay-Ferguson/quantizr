import Picker from "emoji-picker-react";
import { ReactNode } from "react";
import { ValueIntf } from "../../Interfaces";
import { Comp } from "../base/Comp";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class EmojiPicker extends Comp {

    constructor(private selectionValueIntf: ValueIntf) {
        super();
        this.attribs.pickerStyle = { width: "100%", marginBottom: "16px" };
        this.attribs.onEmojiClick = (event: any, emojiObject: any) => {
            console.log("emoji: & #x" + emojiObject.unified + ";");
            this.selectionValueIntf.setValue(emojiObject.emoji);
        };
    }

    compRender = (): ReactNode => {
        return this.tag(Picker, null, this.attribs);
    }
}
