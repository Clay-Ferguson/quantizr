import { ReactNode } from "react";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";

interface LS {
    visible: boolean;
    enabled: boolean;
    content: string;
}

export class MenuItem extends Div {

    constructor(public name: string, public clickFunc: Function, enabled: boolean = true, private stateFunc: Function = null,
        private floatRightComp: CompIntf = null) {
        super(name);
        this.onClick = this.onClick.bind(this);
        this.setEnabled(enabled);
    }

    compRender(): ReactNode {
        let state: LS = this.getState<LS>();
        let _style = { display: (state.visible ? "" : "none") };
        let enablement = state.enabled ? {} : { disabled: "disabled" };
        let enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        let prefix = this.stateFunc && this.stateFunc() ? (S.render.CHAR_CHECKMARK + " ") : "";
        this.setChildren([
            new Span(null, {
                dangerouslySetInnerHTML: { __html: S.render.parseEmojis(prefix + state.content) }
            }),
            this.floatRightComp
        ]);

        return this.tagRender("div", null, {
            ...this.attribs,
            ...enablement,
            ...{
                style: _style,
                className: "list-group-menu-item list-group-item-action " + enablementClass + "  list-group-transparent",
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
