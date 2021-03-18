import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";

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
                        let expanded = document.getElementById("heading" + this.getId()).getAttribute("aria-expanded") === "true";
                        Menu.activeMenu = expanded ? this.name : null;
                        // console.log("Expand or collapse: " + this.name + " expan=" + expanded);
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
