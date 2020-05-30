import { MenuItem } from "./MenuItem";
import { Div } from "./Div";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Menu extends Div {

    constructor(public name: string, menuItems: MenuItem[], isEnabledFunc?: Function, isVisibleFunc?: Function, show?: boolean) {
        super(null, {
            className: "card menuCard"
        });

        this.setChildren(
            [
                new Div(name, {
                    className: "card-header menuHeading mb-0",
                    "data-toggle": "collapse",
                    href: "#collapse" + this.getId(),
                    role: "tab",
                    id: "heading" + this.getId()
                }),

                new Div(null, {
                    id: "collapse" + this.getId(),
                    className: "collapse" + (show ? " show" : ""),
                    role: "tabpanel",
                    "aria-labelledby": "heading" + this.getId(),
                    "data-parent": "#accordion"
                },
                    [
                        new Div(null, {
                            className: "card-body"
                        },
                            [
                                new Div(null, {
                                    className: "list-group flex-column"
                                },
                                    menuItems
                                )
                            ]
                        )
                    ]
                )
            ]
        );

        this.setIsEnabledFunc(isEnabledFunc);
        this.setIsVisibleFunc(isVisibleFunc);
    }

    compRender(): ReactNode {
        let state = this.getState();
        this.attribs.style = { display: (state.visible && !state.disabled ? '' : 'none') };
        return super.compRender();
    }
}
