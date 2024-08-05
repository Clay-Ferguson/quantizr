import { Comp } from "../base/Comp";

export class Pre extends Comp {

    constructor(cont: string = "", attribs: any = null) {
        super(attribs);
        this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(cont);
        this.tag = "pre";
    }
}
