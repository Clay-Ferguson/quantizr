import { getAs } from "../../AppContext";
import { Comp } from "../base/Comp";
import { Img } from "./Img";
import { Italic } from "./Italic";
import { Progress } from "./Progress";
import { Span } from "./Span";

interface LS { // Local State
    visible: boolean;
    disabled: boolean;
    waiting: boolean;
}

/* todo-0: All instantiations of this class should be replaced with the new Button class */
export class IconButton extends Comp {

    constructor(public iconClass: string = "", public text: string, attribs: any = null, specialClasses: string = "", private toggle: string = "", private imageUrl: string = null) {
        super(attribs);
        this.attribs.type = "button";
        specialClasses = specialClasses || "";

        let classes = "clickable " + specialClasses +
            (getAs().mobileMode ? " mobileIconButton" : "");

        // BEGIN HACK -------------------------------------------------------
        // This hack is to ease the transition from Bootstrap to TailwindCSS
        classes = classes.replace("btn ", "");
        // END HACK ---------------------------------------------------------

        classes += " tw-px-4 tw-py-2 tw-border tw-border-gray-400 tw-border-solid";
        if (classes.indexOf("-primary") != -1) {
            classes = classes.replace("-primary", "");
            classes += " tw-bg-blue-600 hover:tw-bg-blue-700 tw-text-white";
        }
        else if (classes.indexOf("-danger") != -1) {
            classes = classes.replace("-danger", "");
            classes += " tw-bg-red-500 hover:tw-bg-red-600 tw-text-white";
        }
        else {
            classes += " tw-bg-gray-600 hover:tw-bg-gray-700 tw-text-white";
        }

        this.attribs.className = classes;
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
            this.children = [new Progress()];
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
