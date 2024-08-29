import { asyncDispatch, getAs } from "../AppContext";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./core/Div";

export class Menu extends Comp {
    constructor(public name: string, public menuItems: Comp[], private func: () => void = null, private floatRightComp: Comp = null, private moreClasses: string = "", private subMenu: boolean = false) {
        super({ key: name, className: "menuCard" });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const expanded = getAs().expandedMenus.has(this.name);
        const clazz = this.subMenu ? (expanded ? "subMenuHeadingExpanded" : "subMenuHeading") : (expanded ? "menuHeadingExpanded" : "menuHeading");

        this.children = [
            new Div(null, {
                className: clazz + (ast.mobileMode ? " mobileMenuText" : "") + " " + this.moreClasses,
                id: "heading" + this.getId(),
                onClick: () => {
                    asyncDispatch("ToggleExpansion", s => S.nav.changeMenuExpansion(s, "toggle", this.name));
                    if (this.func) {
                        this.func();
                    }
                }
            }
                , [this.name, expanded ? this.floatRightComp : null]),

            expanded ? new Div(null, {
                id: "itemsCont-" + this.getId(),
                className: "menuCardBody"
            }, [
                new Div(null, {
                    id: "items-" + this.getId(),
                    className: "menuPanelItems"
                }, this.menuItems)]) : null
        ];
        return true;
    }
}
