import { MenuItem } from "./MenuItem";
import { Div } from "./Div";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

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

        // todo-0: might be bringing this back. not sure
        // this.setIsEnabledFunc(isEnabledFunc);
        // this.setIsVisibleFunc(isVisibleFunc);
    }

    compRender = (): ReactNode => {
        let state = this.getState();
        //console.log("compRender " + this.jsClassName + " state to visible=" + state.visible);
        //todo-0: for now if someething's disabled we just hide it, but eventually we'll put back in the logic
        //for enablement logic as found in Comp base class.
        let _style = { display: (state.visible && !state.disabled ? '' : 'none') };

        //we have to create a clone for sending to S.e, because React has a rule that once it renders the object
        //then becomes readonly
        let _attribs = { ...this.attribs, ...{ style: _style } };

        return this.tagRender('div', state.content, _attribs);
    }
}
