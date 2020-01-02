import { MenuItem } from "./MenuItem";
import { Div } from "./Div";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Menu extends Div {

    constructor(public name: string, menuItems: MenuItem[], isEnabledFunc?: Function, isVisibleFunc?: Function) {
        super(null, {
            className: "card no-border"
        });

        this.setChildren(
            [
                new Div(name, {
                    className: "card-header mainMenuItemEnabled mb-0",
                    "data-toggle": "collapse",
                    "href": "#collapse" + this.getId(),
                    role: "tab",
                    id: "heading" + this.getId()
                }  
                ),

                new Div(null, {
                    id: "collapse" + this.getId(),
                    className: "collapse", // "collapse show",
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
}
