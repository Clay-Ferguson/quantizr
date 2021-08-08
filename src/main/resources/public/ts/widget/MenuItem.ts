import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";
import { Span } from "./Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MenuItem extends Div {

    constructor(public name: string, public clickFunc: Function, enabled: boolean = true, private stateFunc: Function = null,
        private floatRightComp: CompIntf = null) {
        super(name);
        this.onClick = this.onClick.bind(this);
        this.setEnabled(enabled);
    }

    compRender(): ReactNode {
        let state = this.getState();
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
        let state = this.getState();
        if (!state.enabled) return;

        if (S.quanta.mainMenu) {
            S.quanta.mainMenu.close();
        }
        this.clickFunc();
    }
}
