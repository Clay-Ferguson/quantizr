import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";

// todo-0: research of we can do something like this here?
//    var reactNodeLi = React.DOM.li({id:'li1'}, 'one');
//    from: https://www.reactenlightenment.com/react-nodes/4.6.html

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Li extends Comp {

    constructor(public content: string = "", attribs: Object = {}, public initialChildren: Comp[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
    }

    compRender(): ReactNode {
        return createElement("li", this.attribs, this.buildChildren());
    }
}
