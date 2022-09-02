import { useAppState } from "../../AppContext";
import { AppState } from "../../AppState";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { Div } from "../core/Div";
import { Icon } from "../core/Icon";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

export class NodeCompParentNodes extends Div {

    constructor(private state: AppState, public tabData: TabIntf<any>) {
        super(null, {
            id: "parent_" + state.node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });
    }

    preRender(): void {
        const state = useAppState();

        /* Currently our "renderNode" will only ever load a single parent, so we just pull the first element
         from 'parents' array, but the system architecture is such that if we ever want to display
         more than one parent we can implement that easily */
        const node = state.node?.parents?.length > 0 ? state.node?.parents[0] : null;

        if (!node) {
            this.setChildren(null);
            return;
        }

        this.attribs.className = "parentNodeContentStyle";
        const showCloseParentsIcon = state.userPrefs.showParents && state.node.parents?.length > 0;

        this.setChildren([
            state.userPrefs.showMetaData ? new NodeCompRowHeader(node, true, true, false, false, true, false) : null,
            showCloseParentsIcon ? new Icon({
                className: "fa fa-level-up fa-lg showParentsIcon float-end",
                title: "Toggle: Show Parent on page",
                onClick: () => S.edit.toggleShowParents(state)
            }) : null,

            // todo-1: hard-coding 'false' isLinkedNode here. Should only effect styling on openGraphPanel in boosted items,
            // so not worried about that here, for now.
            new NodeCompContent(node, this.tabData, false, true, null, null, true, false, null)
        ]);
    }
}
