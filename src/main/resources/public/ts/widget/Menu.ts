import { ReactNode } from "react";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";

export class Menu extends Div {

    // This can auto expand any menu, but I'm setting to null, to disable, becasue I decided I kinda don't like it.
    static activeMenu: string = null; // "Social";

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
                        let expanded = elm.target.getAttribute("aria-expanded") === "true";
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
