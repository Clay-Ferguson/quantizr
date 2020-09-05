import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Div } from "../widget/Div";
import { NodeCompMainList } from "./NodeCompMainList";
import { NodeCompMainNode } from "./NodeCompMainNode";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class MainTabComp extends Div {

    constructor() {
        super(null, {
            id: "mainTab",
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        if (!state.node) {
            this.setChildren(null);
            return;
        }

        this.setChildren([
            new NodeCompMainNode(state, null),
            new NodeCompMainList()
        ]);
    }
}
