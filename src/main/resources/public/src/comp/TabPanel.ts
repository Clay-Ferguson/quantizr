import { getAs, promiseDispatch } from "../AppContext";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
import { Tailwind } from "../Tailwind";
import { AppTab } from "./AppTab";
import { Comp } from "./base/Comp";
import { RightNavPanel } from "./RightNavPanel";

export class TabPanel extends Comp {
    static inst: TabPanel;

    constructor(private customTopComp: Comp = null) {
        super({ id: C.ID_TAB });
        TabPanel.inst = this;
        const ast = getAs();

        if (ast.mobileMode) {
            this.attribs.className = Tailwind.col_12 + " tabPanelMobile";
        }
        else {
            let panelCols = ast.userPrefs.mainPanelCols || 6;
            if (!ast.showRhs) {
                panelCols += RightNavPanel.calcWidthCols();
            }
            this.attribs.className = Tailwind.getColClass(panelCols) + " tabPanel" + (ast.tour ? " appColumnTourActive" : " appColumn");
        }
    }

    async setVisibility(visible: boolean): Promise<void> {
        return promiseDispatch("SetTabPanelVis", s => {
            s.tabPanelVisible = visible;
        });
    }

    override preRender(): boolean | null {
        const ast = getAs();

        if (!ast.tabPanelVisible) {
            // not sure why, but this had no effect, we're ok without it, but
            // would be nicer if we could hide the comp during preparing final scrolling.
            this.attribs.className += " compHidden";
        }

        this.children = [
            this.customTopComp,
            new Div(null, {
                className: "row tabContent",
                role: "main",
                id: "tabPanelContentId"
            }, this.buildTabs())
        ];
        return true;
    }

    buildTabs(): AppTab[] {
        const ast = getAs();
        const tabs = ast.tabData.map(tab => {
            if (tab.isVisible() && tab.id === ast.activeTab) {
                return tab.constructView(tab);
            }
            return null;
        }).filter(c => !!c);
        return tabs;
    }
}
