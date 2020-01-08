import { Comp } from "./base/Comp";
import { ListBox } from "./ListBox";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ListBoxRow extends Comp {

    /* Each listbox row has a reference to its parent (containing) list box, and needs to ineract with it to coordinate selected items. */
    listBox: ListBox;

    constructor(public content: string, onClick: Function, public selected: boolean) {
        super(null);
        this.setClass("list-group-item list-group-item-action listBoxRow");
        this.setSelectedState(selected);
        this.setOnClick(() => {
            if (this.listBox) {
                this.listBox.rowClickNotify(this);
            }
            if (typeof onClick == "function") {
                onClick();
            }
        });
    }

    setSelectedState = (selected: boolean) => {
        S.dom.whenElm(this.getId(), (elm: HTMLElement) => {
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
