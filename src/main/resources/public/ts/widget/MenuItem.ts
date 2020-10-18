import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MenuItem extends Div {

    constructor(public name: string, public clickFunc: Function, enabled: boolean = true) {
        super(name);
        this.onClick = this.onClick.bind(this);
        this.setEnabled(enabled);
    }

    compRender(): ReactNode {
        let state = this.getState();
        let _style = { display: (state.visible ? "" : "none") };
        let enablement = state.enabled ? {} : { disabled: "disabled" };
        let enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        return this.tagRender("div", state.content, {
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

        if (S.meta64.mainMenu) {
            S.meta64.mainMenu.close();
        }
        this.clickFunc();
    }
}
