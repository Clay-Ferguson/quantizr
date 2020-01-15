import { Div } from "./Div";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { MainMenuPopupDlg } from "../dlg/MainMenuPopupDlg";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MenuItem extends Div {

    constructor(public name: string, public clickFunc: Function, isEnabledFunc?: Function, isVisibleFunc?: Function, bottomSeparator?: boolean) {
        super(name, {
            className: "list-group-item list-group-item-action",
        });

        let func = () => {
            /* always dispose the menu before running the menu function */
            if (S.nav.mainMenuPopupDlg) {
                (<MainMenuPopupDlg>S.nav.mainMenuPopupDlg).close();
            }
            clickFunc();
        };

        this.setOnClick(func);
        this.setIsEnabledFunc(isEnabledFunc);
        this.setIsVisibleFunc(isVisibleFunc);
    }

    compRender = (): ReactNode => {
        let state = this.getState();
        console.log("compRender " + this.jsClassName + "[" + this.name + "] visible=" + state.visible + " enabled=" + state.enabled);
        //todo-0: for now if someething's disabled we just hide it, but eventually we'll put back in the logic
        //for enablement logic as found in Comp base class.
        let _style = { display: (state.visible ? '' : 'none') };
        let enablement = state.enabled ? {} : { disabled: "disabled" };
        let enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        //we have to create a clone for sending to S.e, because React has a rule that once it renders the object
        //then becomes readonly
        let _attribs = { ...this.attribs, ...enablement, ...{ style: _style }, ...{ className: "list-group-item list-group-item-action " + enablementClass } };

        return this.tagRender('div', state.content, _attribs);
    }
}
