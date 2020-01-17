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
        let _style = { display: (state.visible ? '' : 'none') };
        let enablement = state.enabled ? {} : { disabled: "disabled" };
        let enablementClass = state.enabled ? "mainMenuItemEnabled" : "disabled mainMenuItemDisabled";

        return this.tagRender('div', state.content,
            { ...this.attribs, ...enablement, ...{ style: _style, className: "list-group-item list-group-item-action " + enablementClass } }
        );
    }
}
