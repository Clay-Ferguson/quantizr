import { Comp } from "../base/Comp";

export class Para extends Comp {

    constructor(public content: string = null, attribs: any = {}) {
        super(attribs);
        this.setTag("p");
    }

    override preRender = (): boolean => {
        this.setChildren([this.content]);
        return true;
    }
}
