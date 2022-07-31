import { ReactNode } from "react";
import { getAppState } from "../AppRedux";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";

interface LS { // Local State
    visible: boolean;
    enabled: boolean;
    content: string;
}

export class MenuItem extends Div {

    constructor(public name: string, public clickFunc: Function, enabled: boolean = true, private stateFunc: Function = null,
        private floatRightComp: CompIntf = null) {
        super(name);
        this.onClick = this.onClick.bind(this);
        this.mergeState({ visible: true, enabled });
    }

    compRender = (): ReactNode => {
        let state: LS = this.getState<LS>();
        let enablement = state.enabled ? {} : { disabled: "disabled" };
        let enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        let prefix = this.stateFunc && this.stateFunc() ? (S.render.CHAR_CHECKMARK + " ") : "";
        this.setChildren([
            new Span(S.render.parseEmojis(prefix + state.content), null, null, true),
            this.floatRightComp
        ]);

        return this.tag("div", {
            ...this.attribs,
            ...enablement,
            ...{
                style: { display: (state.visible ? "" : "none") },
                className: "list-group-menu-item list-group-item-action " + enablementClass + "  list-group-transparent" +
                    (getAppState().mobileMode ? " mobileMenuText" : ""),
                onClick: this.onClick
            }
        });
    }

    onClick(): void {
        let state = this.getState<LS>();
        if (!state.enabled) return;

        if (S.quanta.mainMenu) {
            S.quanta.mainMenu.close();
        }
        this.clickFunc();
    }
}
