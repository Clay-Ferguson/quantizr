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
        this.mergeState({ selectedPayload: null });

        this.rowClick = this.rowClick.bind(this);
        this.isSelectedFunc = this.isSelectedFunc.bind(this);
    }

    rowClick(row: ListBoxRow): void {
        //console.log("Merging state with selectedPayload="+row.payload);
        this.mergeState({
            selectedPayload: row.payload
        });
    }

    isSelectedFunc(row: ListBoxRow): boolean {
        let state = this.getState();
        let ret = state.selectedPayload == row.payload;
        //console.log("isSelectedFunc: state.selectedPayload=" + state.selectedPayload + " row.id=[" + row.getId() + "] SELECTED=" + ret);
        return ret;
    }
}
