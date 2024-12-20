import { getAs } from "../AppContext";
import { TabBase } from "../intf/TabBase";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";

/* NOTE: All classes derived from AppTab should have each top-level (in the vertical dimension) item
having a class 'data.id' tacked on to it. This class is expected to be there for managing scrolling,
and also the IDs on each of those elements needs to be repeatable across all renders. */

// PT=Properties Type
export class AppTab<PT = any> extends Comp {
    headingBar: Comp = null;

    constructor(public data: TabBase<PT>, private extraEditModeClass: string = null) {
        super({
            id: data.id,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "2"
        });

        this.attribs.className = this.getClass();
    }

    getClass(): string {
        const ast = getAs();
        const className = "appTabPane customScrollbar " +
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

    scrollToNode(nodeId: string): boolean {
        if (!nodeId) return;
        const domId = S.tabUtil.makeDomIdForNode(this.data, nodeId);
        const elm = S.domUtil.domElm(domId);
        if (elm) {
            this.scrollToElm(elm);
            return true;
        }
        else {
            console.log("elm not found: " + domId);
        }
        return false;
    }

    scrollToElm(elm: HTMLElement): void {
        if (!elm) return;
        const headingBarHeight = this.headingBar?.getRef()?.offsetHeight || 0;
        let top = elm.offsetTop - headingBarHeight;
        if (top < 0) top = 0;

        // If we were gonna scroll somewhere near the top of the page go ahead and scroll to the
        // the top and the node we're interested in will be no lower than the middle of the
        // screen.
        if (top < window.innerHeight / 2) {
            top = 0;
        }

        if (this.data.scrollPos <= top && top + elm.offsetHeight < this.data.scrollPos + window.innerHeight) {
            // if we get here, the entire 'elm' should be visible on the page already
            // console.log("no scroll needed.");
        }
        else {
            this.setScrollTop(top);
        }
    }
}
