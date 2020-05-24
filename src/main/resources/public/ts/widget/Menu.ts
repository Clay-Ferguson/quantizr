import { MenuItem } from "./MenuItem";
import { Div } from "./Div";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Menu extends Div {

    constructor(public name: string, menuItems: MenuItem[], isEnabledFunc?: Function, isVisibleFunc?: Function) {
        super(null, {
            className: "card menuCard"
        });

        this.setChildren(
            [
                new Div(name, {
                    className: "card-header menuHeading mb-0",
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

    /* todo-0: look at this again. This function has an ugly look to it */
    compRender(): ReactNode {
        let state = this.getState();
        //console.log("compRender " + this.jsClassName + " state to visible=" + state.visible);
        let _style = { display: (state.visible && !state.disabled ? '' : 'none') };
        let _attribs = { ...this.attribs, ...{ style: _style } };

        return this.tagRender('div', state.content, _attribs);
    }
}
