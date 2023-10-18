import { Comp } from "../base/Comp";
import { Div } from "./Div";

/* Diva = Div with Array only */
export class Diva extends Div {
    constructor(children: Comp[] = null) {
        super(null);
        this.setChildren(children);
    }
}
