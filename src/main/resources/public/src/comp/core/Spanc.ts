import { Comp } from "../base/Comp";

export class Spanc extends Comp {
    constructor(attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("span");
    }
}
