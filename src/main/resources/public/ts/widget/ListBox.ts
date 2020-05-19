import { Comp } from "./base/Comp";
import { ListBoxRow } from "./ListBoxRow";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ListBox extends Comp {

    constructor() {
        super(null);
        this.setClass("list-group marginBottom");
        this.mergeState({ selectedRowId: null });
    }

    rowClickNotify = (row: ListBoxRow): void => {
        this.mergeState({
            selectedRowId: row.getId()
        })
    }

    compRender(): ReactNode {
        let state = this.getState();
        this.children.forEach(function (row: ListBoxRow) {
            if (row) {
                row.selected = state.selectedRowId==row.getId();
                row.setListBox(this);
            }
        }, this);

        return this.tagRender('div', null, this.attribs);
    }
}
