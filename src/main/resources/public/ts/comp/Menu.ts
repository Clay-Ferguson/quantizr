import { ReactNode } from "react";
import { dispatch, useAppState } from "../AppRedux";
import { Div } from "../comp/core/Div";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";
import { S } from "../Singletons";

export class Menu extends Comp {
    static userClickedMenu: boolean = false;

    constructor(public name: string, public menuItems: CompIntf[], private func: Function = null, private floatRightComp: CompIntf = null) {
        super({ id: "menu_" + S.util.hashOfString(name), className: "menuCard" });
    }

    compRender = (): ReactNode => {
        const appState = useAppState();
        const expanded = appState.activeMenu.has(this.name);

        this.setChildren([
            new Div(this.name, {
                className: (expanded ? "menuHeadingExpanded" : "menuHeading") + (appState.mobileMode ? " mobileMenuText" : ""),
                id: this.getId("heading"),
                onClick: () => {
                    dispatch("setActiveMenu", (s) => {
                        if (s.activeMenu.has(this.name)) {
                            s.activeMenu.delete(this.name);
                        }
                        else {
                            s.activeMenu.add(this.name);
                        }
                        return s;
                    });

                    Menu.userClickedMenu = true;
                    if (this.func) {
                        this.func();
                    }
                }
            }
                , [expanded ? this.floatRightComp : null]),

            expanded ? new Div(null, {
                id: this.getId("itemsCont"),
                className: "menuCardBody"
            }, [
                new Div(null, {
                    id: this.getId("items"),
                    className: "menuPanelItems"
                }, this.menuItems)]) : null
        ]);
        return this.tag("div");
    }
}
