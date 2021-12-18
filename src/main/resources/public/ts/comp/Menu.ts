import { ReactNode } from "react";
import { CompIntf } from "./base/CompIntf";
import { Div } from "../comp/core/Div";

interface LS { // Local State
    visible: boolean;
    disabled: boolean;
}

export class Menu extends Div {

    static userClickedMenu: boolean = false;
    static activeMenu: string = null;

    constructor(public name: string, public menuItems: CompIntf[], private onClickCallback: Function = null) {
        super(null, {
            className: "card menuCard accordion-item"
        });
    }

    compRender(): ReactNode {
        let state = this.getState<LS>();
        this.attribs.style = { display: (state.visible && !state.disabled ? "" : "none") };
        let show = Menu.activeMenu === this.name;
        // console.log("MENU: " + this.name + " active=" + show);

        this.setChildren([
            new Div(this.name, {
                className: "card-header menuHeading mb-0 accordion-header",
                "aria-expanded": Menu.activeMenu === this.name ? "true" : "false",
                "data-bs-toggle": "collapse",
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
                        Menu.userClickedMenu = true;
                        // console.log("Expand or collapse: " + this.name + " expan=" + expanded);
                        if (this.onClickCallback) {
                            this.onClickCallback();
                        }
                    }, 500);
                }
            }),

            new Div(null, {
                id: "collapse" + this.getId(),
                className: "accordion-collapse collapse" + (show ? " show" : ""),
                role: "tabpanel",
                "aria-labelledby": "heading" + this.getId(),
                "data-bs-parent": "#accordion"
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
