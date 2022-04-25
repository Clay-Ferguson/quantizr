import { ReactNode } from "react";
import { Div } from "../comp/core/Div";
import { CompIntf } from "./base/CompIntf";

interface LS { // Local State
    visible: boolean;
    disabled: boolean;
    expanded: boolean;
}

export class Menu extends Div {

    static userClickedMenu: boolean = false;
    static activeMenu: string = null;

    constructor(public name: string, public menuItems: CompIntf[], private onClickCallback: Function = null, private floatRightComp: CompIntf = null) {
        super(null, {
            className: "card menuCard accordion-item"
        });
    }

    compRender(): ReactNode {
        let state = this.getState<LS>();
        this.attribs.style = {
            display: (state.visible && !state.disabled ? "" : "none"),
            expanded: false
        };
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
                        // we need a pub-sub call that can force the ENTIRE menu panel to refresh.
                        this.mergeState({ expanded });
                    }, 500);
                }
            }
            // This is the help icon, and it's not working correctly yet, because it won't successfully go away unless
            // the menu is specifically clicked to close it, and I don't want that behavior.
            // todo-0: we need to move the 'Menu.activeMenu' into the AppState, and then the mergeState above can be used
            // to update the menu, and we might not even then need the 'expanded' property in this LS local state.
            /* , [Menu.activeMenu === this.name ? this.floatRightComp : null] */),

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
