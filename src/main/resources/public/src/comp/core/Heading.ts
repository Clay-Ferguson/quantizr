import { Comp } from "../base/Comp";

export class Heading extends Comp {

    constructor(public level: number, public content: string, attrs: any = {}) {
        super(attrs);
        this.setTag("h" + this.level)
    }

    override preRender = (): boolean => {
        this.setChildren([this.content]);
        return true;
    }
}
