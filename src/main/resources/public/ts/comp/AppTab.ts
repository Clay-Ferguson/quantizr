import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { TabIntf } from "../intf/TabIntf";

/* NOTE: All classes derived from AppTab should have each top-level (in the vertical dimension) item having
a class 'data.id' tacked on to it. This class is expected to be there for managing scrolling, and also the
IDs on each of those elements needs to be repeatable across all renders. */
export class AppTab<T = any> extends Div {
    constructor(public data: TabIntf<T>, private extraEditModeClass: string = null) {
        super(null, {
            id: data.id,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "2"
        });
        // console.log("Constructed AppTab: " + data.id);
    }

    getClass = (ast: AppState): string => {
        const className = (ast.mobileMode ? "my-tab-pane-mobile " : "my-tab-pane ") + "customScrollbar " +
            (ast.userPrefs.editMode && this.extraEditModeClass ? (this.extraEditModeClass) : "") +
            (ast.activeTab === this.getId() ? " visible" : " invisible");
        return className;
    }

    getScrollPos = (): number => {
        return this.data.scrollPos;
    }

    setScrollPos = (pos: number): void => {
        this.data.scrollPos = pos;
    }
}
