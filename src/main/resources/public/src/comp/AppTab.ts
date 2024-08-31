import { getAs } from "../AppContext";
import { Div } from "../comp/core/Div";
import { TabIntf } from "../intf/TabIntf";
import { Comp } from "./base/Comp";

/* NOTE: All classes derived from AppTab should have each top-level (in the vertical dimension) item
having a class 'data.id' tacked on to it. This class is expected to be there for managing scrolling,
and also the IDs on each of those elements needs to be repeatable across all renders. */

// PT=Properties Type, TT=Tab Type
export class AppTab<PT = any, TT = any> extends Div {
    headingBar: Comp = null;

    constructor(public data: TabIntf<PT, TT>, private extraEditModeClass: string = null) {
        super(null, {
            id: data.id,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "2"
        });

        this.attribs.className = this.getClass();
    }

    getClass(): string {
        const ast = getAs();
        const className = (ast.mobileMode ? "appTabPaneMobile" : "appTabPane") + " customScrollbar " +
            (ast.userPrefs.editMode && this.extraEditModeClass ? (this.extraEditModeClass) : "") +
            (ast.activeTab === this.getId() ? " visible" : " invisible");
        return className;
    }

    override getScrollPos(): number {
        return this.data.scrollPos;
    }

    override setScrollPos(pos: number): void {
        this.data.scrollPos = pos;
    }
}
