import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class SpanHtml extends Comp {
    constructor(public content: string = "", attribs: any = null) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.setTag("span");
    }

    override preRender = (): boolean => {
        this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(this.content);
        return true;
    }
}
