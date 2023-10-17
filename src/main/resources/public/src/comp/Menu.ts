import { ReactNode } from "react";
import { asyncDispatch, getAs } from "../AppContext";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";
import { Divc } from "./core/Divc";

export class Menu extends Comp {
    constructor(public name: string, public menuItems: CompIntf[], private func: () => void = null, private floatRightComp: CompIntf = null, private moreClasses: string = "", private subMenu: boolean = false) {
        super({ id: "menu_" + S.util.hashOfString(name), className: "menuCard" });
    }

    override compRender = (): ReactNode => {
        const ast = getAs();
        const expanded = getAs().expandedMenus.has(this.name);
        const clazz = this.subMenu ? (expanded ? "subMenuHeadingExpanded" : "subMenuHeading") : (expanded ? "menuHeadingExpanded" : "menuHeading");

        this.setChildren([
            new Divc({
                className: clazz + (ast.mobileMode ? " mobileMenuText" : "") + " " + this.moreClasses,
                id: this.getId("heading"),
                onClick: () => {
                    asyncDispatch("ToggleExpansion", s => S.nav.changeMenuExpansion(s, "toggle", this.name));
                    if (this.func) {
                        this.func();
                    }
                }
            }
                , [this.name, expanded ? this.floatRightComp : null]),

            expanded ? new Divc({
                id: this.getId("itemsCont"),
                className: "menuCardBody"
            }, [
                new Divc({
                    id: this.getId("items"),
                    className: "menuPanelItems"
                }, this.menuItems)]) : null
        ]);
        return this.tag("div");
    }
}
