import { Comp } from "../base/Comp";

export class SpanHtml extends Comp {
    constructor(public cont: string = "", attribs: any = null) {
        super(attribs);
        this.tag = "span";
    }

    override preRender = (): boolean => {
        this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(this.cont);
        return true;
    }
}
