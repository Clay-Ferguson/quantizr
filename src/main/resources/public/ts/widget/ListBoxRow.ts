import { Div } from "./Div";

export class ListBoxRow extends Div {

    /* The isSelectedFunc is a way of delegating the state holding which row is selected to to the parent ListBox itself */
    constructor(content: string = null, onClickFunc: Function = null) {
        super(content, {
            className: "list-group-item list-group-item-action listBoxRow",
        });

        if (onClickFunc) {
            this.attribs.onClick = onClickFunc;
        }
    }
}
