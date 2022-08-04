import { ReactNode } from "react";
import { getAppState } from "../../AppRedux";
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
        this.attribs.className = "btn align-middle clickable " + specialClasses +
            (getAppState().mobileMode ? " mobileIconButton" : "");
        this.mergeState({ visible: true });
    }

    compRender = (): ReactNode => {
        const state = this.getState<LS>();
        this.attribs.style = { display: (state.visible && !state.disabled ? "" : "none") };

        return this.tag("button", null, [
            this.imageUrl ? new Img(null, {
                key: this.getId("img_"),
                src: this.imageUrl
            }) : null,
            new Italic({
                key: this.getId("i_"),
                className: "fa " + this.iconClass + (this.toggle === "on" ? " iconToggleOn" : " iconToggleOff")
            }),
            this.text ? new Span(this.text, {
                key: this.getId("t_"),
                className: "icon-button-font"
            }) : null
        ]);
    }
}
