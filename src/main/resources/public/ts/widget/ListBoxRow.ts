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
    constructor(private listBox: ListBox, content: string, public payload: any, public isSelectedFunc: (row: ListBoxRow) => boolean) {
        super(content, {
            className: "list-group-item list-group-item-action listBoxRow",
        });

        // todo-0: possibly could do 'auto-wrapping' using something like this:
        // getMethods = (obj) => Object.getOwnPropertyNames(obj).filter(item => typeof obj[item] === 'function')
        // in a utility method that binds all methods automatically to 'this' if they start with an understore.
        this.onClick = this.onClick.bind(this);
        this.attribs.onClick = this.onClick;
    }

    onClick() {
        this.listBox.rowClick(this);
    }

    preRender(): void {
        this.attribs.className = "list-group-item list-group-item-action listBoxRow" + (this.isSelectedFunc(this) ? " selectedListItem" : "");
    }
}
