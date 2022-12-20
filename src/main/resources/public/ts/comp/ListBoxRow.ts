import { Div } from "../comp/core/Div";

export class ListBoxRow extends Div {

    /* The isSelectedFunc is a way of delegating the state holding which row is selected to to the parent ListBox itself */
    constructor(content: string = null, onClickFunc: Function = null, className: string = "listBoxRow") {
        super(content, {
            className
        });

        if (onClickFunc) {
            this.attribs.onClick = onClickFunc;
        }
    }
}
