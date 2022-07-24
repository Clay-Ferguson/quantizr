import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { Img } from "./Img";
import { Italic } from "./Italic";
import { Span } from "./Span";

interface LS { // Local State
    visible: boolean;
    disabled: boolean;
}

export class IconButton extends Comp {
    constructor(public iconClass: string = "", public text: string, attribs: Object = {}, private specialClasses: string = "btn-secondary", private toggle: string = "", private imageUrl: string = null) {
        super(attribs);
        this.attribs.type = "button";
        // somehow this 'clickable' class seems to have no effect
        this.attribs.className = "btn align-middle clickable " + specialClasses;
        this.mergeState({ visible: true });
    }

    compRender = (): ReactNode => {
        let state = this.getState<LS>();
        this.attribs.style = { display: (state.visible && !state.disabled ? "" : "none") };

        let iconClazz: string = "fa " + this.iconClass;
        if (this.toggle === "on") {
            iconClazz += " iconToggleOn";
        }
        else if (this.toggle === "off") {
            iconClazz += " iconToggleOff";
        }
        else {
            iconClazz += " iconToggleOff";
        }

        let children = [];
        if (this.imageUrl) {
            children.push(new Img(null, {
                key: "s_img_" + this.getId(),
                src: this.imageUrl
            }));
        }

        children.push(new Italic({
            key: "i_" + this.getId(),
            className: iconClazz
        }));

        if (this.text) {
            children.push(new Span(this.text, {
                key: "s_txt_" + this.getId(),
                className: "icon-button-font"
            }));
        }
        return this.tag("button", null, children);
    }
}
