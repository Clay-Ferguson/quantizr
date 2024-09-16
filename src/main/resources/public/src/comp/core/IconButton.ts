import { getAs } from "../../AppContext";
import { Comp } from "../base/Comp";
import { Img } from "./Img";
import { Italic } from "./Italic";
import { Span } from "./Span";
import { Spinner } from "./Spinner";

interface LS { // Local State
    visible: boolean;
    disabled: boolean;
    waiting: boolean;
}

export class IconButton extends Comp {

    constructor(public iconClass: string = "", public text: string, attribs: any = null, specialClasses: string = "btn-secondary", private toggle: string = "", private imageUrl: string = null) {
        super(attribs);
        this.attribs.type = "button";
        specialClasses = specialClasses || "";

        // tolerate caller not providing a btn- class and add secondary as default.
        if (specialClasses.indexOf("btn-") === -1) {
            specialClasses = "btn-secondary " + specialClasses;
        }

        this.attribs.className = "btn align-middle clickable " + specialClasses +
            (getAs().mobileMode ? " mobileIconButton" : "");
        this.mergeState({ visible: true });
    }

    replaceWithWaitIcon(): void {
        this.mergeState({ waiting: true });
    }

    override preRender(): boolean | null {
        const state = this.getState<LS>();

        // this gets activated when the user clicks an infinite scrolling button, so it turns into a spinner
        // while loading more records
        if (state.waiting) {
            this.tag = "span";
            this.children = [new Spinner()];
            return true;
        }

        this.attribs.style = { display: (state.visible && !state.disabled ? "" : "none") };
        this.children = [
            this.imageUrl ? new Img({
                key: "img_" + this.getId(),
                src: this.imageUrl
            }) : null,
            new Italic({
                key: "i_" + this.getId(),
                className: "fa " + this.iconClass + (this.toggle === "on" ? " iconToggleOn" : " iconToggleOff")
            }),
            this.text ? new Span(this.text, {
                key: "t_" + this.getId(),
                className: "iconButtonFont"
            }) : null
        ];
        this.tag = "button";
        return true;
    }
}
