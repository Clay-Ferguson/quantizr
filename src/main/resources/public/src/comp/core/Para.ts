import { Comp } from "../base/Comp";

export class Para extends Comp {

    constructor(public content: string = null, attribs: any = null) {
        super(attribs);
        this.tag = "p";
    }

    override preRender = (): boolean => {
        this.children = [this.content];
        return true;
    }
}
