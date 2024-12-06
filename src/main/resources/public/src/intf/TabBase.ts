import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { OpenGraphPanel } from "../comp/OpenGraphPanel";
import { NodeInfo } from "../JavaIntf";

// PT=PropsType
export class TabBase<PT = any> {
    // display name shown on the tab
    name: string;

    // help tooltip for menu
    tooltip: string;

    /* DOM ID of the tab button itself, but also the unique identifier for the tab. Note: even if there are perhaps
     multiple different instances of the same AppTab-derived class each one will need to have a unique id. This means
    we can in the future support multiple SearchView tabs opened simultaneously, each with a different ID of course.

    This 'id' is used as an 'identification-only' class name on each of the rows/nodes displayed on any tab
    */
    id: string;
    scrollPos: number = 0;
    inst?: AppTab<PT> = null;

    // used for re-scrolling screen back to same place after the page layout may have changed due to 'edit mode' or 'info mode'
    // turning on/off or other places.
    topmostVisibleElmId: string = null;

    props: PT = {} as PT;
    openGraphComps: OpenGraphPanel[] = [];

    constructView(_data: TabBase<PT>): Comp { return null; }

    // controls whether to show tab button or not.
    isVisible(): boolean { return false; }

    getTabSubOptions(): Div { return null; }

    findNode(_nodeId: string): NodeInfo { return null; }

    findNodeByPath(_path: string): NodeInfo { return null; }

    nodeDeleted(_ust: AppState, _nodeId: string): void { }

    replaceNode(_ust: AppState, _newNode: NodeInfo): void { }

    processNode(_ust: AppState, _func: (node: NodeInfo) => void): void { }
}
