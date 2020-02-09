import { Comp } from "./base/Comp";
import { ListBoxRow } from "./ListBoxRow";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ListBox extends Comp {
    selectedRow: ListBoxRow = null;

    constructor() {
        super(null);
        this.setClass("list-group marginBottom");
    }

    rowClickNotify = (row: ListBoxRow): void => {
        /* Unselect any previously selected row */
        if (this.selectedRow) {
            this.selectedRow.setSelectedState(false);
        }

        /* Select the row that just got clicked */
        this.selectedRow = row;
        this.selectedRow.setSelectedState(true);
    }

    compRender = (): ReactNode => {
         /* For each of the ListBoxRows we need to tell them all who their parent is */
         this.children.forEach((row: ListBoxRow) => {
            if (row) {
                if (row.selected) {
                    this.selectedRow = row;
                }
                row.setListBox(this);
            }
        });

        return this.tagRender('div', null, this.attribs);
    }
}
