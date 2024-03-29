import { getAs } from "../AppContext";
import { S } from "../Singletons";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { Comp } from "./base/Comp";
import { Checkbox } from "./core/Checkbox";
import { Tag } from "./core/Tag";

interface LS { // Local State
    visible: boolean;
    enabled: boolean;
    content: string;
}

export class MenuItem extends Div {

    constructor(public name: string, public clickFunc: () => void, enabled: boolean = true, private stateFunc: () => boolean = null,
        private treeOp: boolean = null, private moreClasses: string = "") {
        super(name);
        this.onClick = this.onClick.bind(this);
        this.mergeState({ visible: true, enabled });
    }

    override preRender = (): boolean => {
        const state: LS = this.getState<LS>();
        const enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        let innerSpan: Comp;
        let innerClazz: string;
        if (this.stateFunc) {
            innerSpan = new Checkbox(state.content, { className: "marginRight" }, {
                setValue: (_checked: boolean) => this.onClick(),
                getValue: (): boolean => this.stateFunc()
            });
            innerClazz = "listGroupMenuItemCompact " + this.moreClasses;
        }
        else {
            innerSpan = new Span(state.content);
            innerClazz = "listGroupMenuItem " + this.moreClasses;
        }

        this.setChildren([
            innerSpan,
            this.treeOp ? new Tag("i", {
                className: "fa fa-caret-right fa-lg float-end " + (state.enabled ? "menuIcon" : "menuIconDisabled"),
                title: "Operates on the selected Tree Nodes(s)",
            }) : null
        ]);

        if (state.enabled) {
            this.attribs.disabled = "disabled";
        }

        this.attribs.style = { display: (state.visible ? "" : "none") };
        this.attribs.className = innerClazz + " list-group-item-action " + enablementClass + "  listGroupTransparent" +
            (getAs().mobileMode ? " mobileMenuText" : "") + " " + this.moreClasses;
        this.attribs.onClick = this.onClick
        return true
    }

    onClick(): void {
        const state = this.getState<LS>();
        if (!state.enabled) return;

        if (S.quanta.mainMenu) {
            S.quanta.mainMenu.close();
        }
        this.clickFunc();
    }
}
