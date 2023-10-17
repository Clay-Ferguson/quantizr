import { Comp } from "../base/Comp";

export class Pre extends Comp {

    constructor(public content: string = "", attribs: any = {}) {
        super(attribs);
        this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(this.content);
        this.setTag("pre");
    }
}
