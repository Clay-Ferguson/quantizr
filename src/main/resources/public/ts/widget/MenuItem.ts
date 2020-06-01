import { Div } from "./Div";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MenuItem extends Div {

    constructor(public name: string, public clickFunc: Function, enabled: boolean=true) {
        super(name);
        this.state.content = name;
        this.onClick = this.onClick.bind(this);
        this.setEnabled(enabled);
    }

    compRender(): ReactNode {
        let state = this.getState();
        let _style = { display: (state.visible ? '' : 'none') };
        let enablement = state.enabled ? {} : { disabled: "disabled" };
        let enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        return this.tagRender("div", state.content, {
            ...this.attribs, ...enablement, ...{
                style: _style,
                className: "list-group-menu-item list-group-item-action " + enablementClass + "  list-group-transparent",
                onClick: this.onClick
            }
        });
    }

    onClick(): void {
        let state = this.getState();
        if (!state.enabled) return;
        
        //Note: We're not always hosted in a dialog.
        if (S.mainMenu) {
            S.mainMenu.close();
        }
        this.clickFunc();
    }
}
