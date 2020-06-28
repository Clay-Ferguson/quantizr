import { ListBox } from "./ListBox";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ListBoxRow extends Div {

    /* The isSelectedFunc is a way of delegating the state holding which row is selected to to the parent ListBox itself */
    constructor(private listBox: ListBox = null, content: string = null, public payload: any = null, public isSelectedFunc: (row: ListBoxRow) => boolean = null) {
        super(content, {
            className: "list-group-item list-group-item-action listBoxRow",
        });

        this.onClick = this.onClick.bind(this);
        this.attribs.onClick = this.onClick;
    }

    onClick() {
        if (this.listBox) {
            this.listBox.rowClick(this);
        }
    }

    preRender(): void {
        this.attribs.className = "list-group-item list-group-item-action listBoxRow" +
            ((this.isSelectedFunc && this.isSelectedFunc(this)) ? " selectedListItem" : "");
    }
}
