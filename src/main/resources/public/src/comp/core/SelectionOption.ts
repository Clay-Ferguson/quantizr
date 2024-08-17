import { Comp } from "../base/Comp";

export class SelectionOption extends Comp {

    constructor(public key: string, public val: string) {
        super(null);
        this.attribs.value = this.key;
        this.tag = "option";
    }

    override preRender = (): boolean => {
        this.attribs.className = "selectOption";
        this.children = [this.val];
        return true;
    }
}
