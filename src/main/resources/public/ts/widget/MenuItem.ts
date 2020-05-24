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

    constructor(public name: string, public clickFunc: Function, isEnabledFunc?: Function, isVisibleFunc?: Function, bottomSeparator?: boolean) {
        super(name, {
            className: "list-group-item list-group-item-action",
            onClick: function () {
                S.mainMenu.close();
                clickFunc();
            }
        });

        this.setIsEnabledFunc(isEnabledFunc);
        this.setIsVisibleFunc(isVisibleFunc);
        this.state.content = name;
    }

    compRender(): ReactNode {
        let state = this.getState();
        let _style = { display: (state.visible ? '' : 'none') };
        let enablement = state.enabled ? {} : { disabled: "disabled" };
        let enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        return this.tagRender("div", state.content,
            { ...this.attribs, ...enablement, ...{ style: _style, className: "list-group-item list-group-item-action " + enablementClass } }
        );
    }
}
