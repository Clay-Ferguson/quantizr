import { Comp } from "./base/Comp";
import { ListBox } from "./ListBox";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ListBoxRow extends Comp {

    /* Each listbox row has a reference to its parent (containing) list box, and needs to ineract with it to coordinate selected items. */
    listBox: ListBox;

    constructor(public content: string, private onClickCallback: Function, public selected: boolean) {
        super({
            className: "list-group-item list-group-item-action listBoxRow"
        });

        this.attribs.onClick = this.onClick;
        this.setSelectedState(selected);
    }

    onClick = () => {
        if (this.listBox) {
            this.listBox.rowClickNotify(this);
        }
        if (this.onClickCallback) {
            this.onClickCallback();
        }
    }

    /* todo-0: this isn't a very 'react'-ish way to do things */
    setSelectedState = (selected: boolean) => {
        this.whenElm((elm: HTMLElement) => {
            if (selected) {
                S.util.addClassToElm(elm, "selectedListItem");
            }
            else {
                S.util.removeClassFromElm(elm, "selectedListItem");
            }
        });
    }

    setListBox(listBox: ListBox) {
        this.listBox = listBox;
    }

    compRender = (): ReactNode => {
        return this.tagRender('div', this.content, this.attribs);
    }
}
