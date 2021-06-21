import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});
export class Menu extends Div {

    static activeMenu: string = C.SITE_NAV_MENU_TEXT;

    constructor(public name: string, public menuItems: CompIntf[]) {
        super(null, {
            className: "card menuCard"
        });
    }

    compRender(): ReactNode {
        let state = this.getState();
        this.attribs.style = { display: (state.visible && !state.disabled ? "" : "none") };
        let show = Menu.activeMenu === this.name;
        // console.log("MENU: " + this.name + " active=" + show);

        this.setChildren([
            new Div(this.name, {
                className: "card-header menuHeading mb-0",
                "aria-expanded": Menu.activeMenu === this.name ? "true" : "false",
                "data-toggle": "collapse",
                // "data-target": "#collapse" + this.getId(),
                href: "#collapse" + this.getId(),
                role: "tab",
                id: "heading" + this.getId(),
                onClick: (elm) => {
                    setTimeout(() => {
                        /* "aria-expanded" attribute won't have been updated yet when this onClick is called, so we have a delay
                        timer here to wait for it to get updated */
                        let headingElm = document.getElementById("heading" + this.getId());
                        let expanded = headingElm && headingElm.getAttribute("aria-expanded") === "true";
                        Menu.activeMenu = expanded ? this.name : null;
                        // console.log("Expand or collapse: " + this.name + " expan=" + expanded);

                        // todo-0: proof of concept temporary hack, verifying this works before doing 'correctly'.
                        // This works well and will be sent in as an "onClickCallback" member variable, soon.
                        if (this.name === "Bookmarks") {
                            S.meta64.loadBookmarks();
                        }
                    }, 500);
                }
            }),

            new Div(null, {
                id: "collapse" + this.getId(),
                className: "collapse" + (show ? " show" : ""),
                role: "tabpanel",
                "aria-labelledby": "heading" + this.getId(),
                "data-parent": "#accordion"
            }, [
                new Div(null, {
                    className: "card-body menuCardBody"
                }, [
                    new Div(null, {
                        className: "list-group flex-column"
                    },
                        this.menuItems)
                ])
            ])
        ]);

        return super.compRender();
    }
}
