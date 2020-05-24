import { ListBoxRow } from "./ListBoxRow";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ListBox extends Div {

    constructor() {
        super();
        this.setClass("list-group marginBottom");
        this.mergeState({ selectedRowId: null });
    }

    rowClickNotify = (row: ListBoxRow): void => {
        this.mergeState({
            selectedRowId: row.getId()
        })
    }

    preRender(): void {
        let state = this.getState();
        this.children.forEach(function (row: ListBoxRow) {
            if (row) {
                row.selected = state.selectedRowId==row.getId();
                row.setListBox(this);
            }
        }, this);
    }
}
