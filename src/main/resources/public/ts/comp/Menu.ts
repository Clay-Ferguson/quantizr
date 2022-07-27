import { ReactNode } from "react";
import { dispatch, useAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

interface LS { // Local State
    visible: boolean;
    disabled: boolean;
    expanded: boolean;
}

export class Menu extends Comp {
    static userClickedMenu: boolean = false;

    constructor(public name: string, public menuItems: CompIntf[], private func: Function = null, private floatRightComp: CompIntf = null) {
        super({ className: "card menuCard accordion-item" });
        this.mergeState({ visible: true });
    }

    compRender = (): ReactNode => {
        let state = this.getState<LS>();
        let appState = useAppState();
        this.attribs.style = {
            display: (state.visible && !state.disabled ? "" : "none"),
            expanded: false
        };
        let show = appState.activeMenu === this.name;
        // console.log("MENU: " + this.name + " active=" + show + " activeMenu=" + appState.activeMenu);

        this.setChildren([
            new Div(this.name, {
                className: "card-header menuHeading mb-0 accordion-header",
                "aria-expanded": appState.activeMenu === this.name ? "true" : "false",
                "data-bs-toggle": "collapse",
                href: this.getId("#collapse"),
                role: "tab",
                id: this.getId("heading"),
                onClick: () => {
                    setTimeout(() => {
                        /* "aria-expanded" attribute won't have been updated yet when this onClick is called, so we have a delay
                        timer here to wait for it to get updated */
                        let headingElm = document.getElementById(this.getId("heading"));
                        let expanded = headingElm && headingElm.getAttribute("aria-expanded") === "true";
                        let activeName = expanded ? this.name : null;

                        dispatch("setActiveMenu", (s) => {
                            s.activeMenu = activeName;
                            return s;
                        });

                        Menu.userClickedMenu = true;
                        // console.log("Expand or collapse: " + this.name + " expan=" + expanded);
                        if (this.func) {
                            this.func();
                        }
                        // we need a pub-sub call that can force the ENTIRE menu panel to refresh.
                        this.mergeState({ expanded });
                    }, 250);
                }
            }
                , [appState.activeMenu === this.name ? this.floatRightComp : null]),

            new Div(null, {
                id: this.getId("collapse"),
                className: "accordion-collapse collapse" + (show ? " show" : ""),
                role: "tabpanel",
                "aria-labelledby": this.getId("heading"),
                "data-bs-parent": "#accordion"
            }, [
                new Div(null, { className: "card-body menuCardBody" }, [
                    new Div(null, { className: "list-group flex-column" },
                        this.menuItems)
                ])
            ])
        ]);

        return this.tag("div");
    }
}
