import { Comp } from "../base/Comp";

export class Heading extends Comp {

    constructor(public level: number, public cont: string, attrs: any = {}) {
        super(attrs);
        this.tag = "h" + this.level;
    }

    override preRender = (): boolean => {
        this.children = [this.cont];
        return true;
    }
}
