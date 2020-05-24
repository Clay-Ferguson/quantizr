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

    /* Each listbox row has a reference to its parent (containing) list box, and needs to ineract with it to coordinate selected items. */
    listBox: ListBox;

    constructor(content: string, private onClickCallback: Function, public selected: boolean) {
        super(content, {
            className: "list-group-item list-group-item-action listBoxRow",
        });

        this.attribs.onClick = this.onClick;
    }

    onClick = () => {
        if (this.listBox) {
            this.listBox.rowClickNotify(this);
        }
        if (this.onClickCallback) {
            this.onClickCallback();
        }
    }

    setListBox(listBox: ListBox) {
        this.listBox = listBox;
    }

    preRender(): void {
        this.attribs.className = "list-group-item list-group-item-action listBoxRow" + (this.selected ? " selectedListItem" : "");
    }
}
