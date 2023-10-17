import { Comp } from "../base/Comp";

export class SelectionOption extends Comp {

    constructor(public key: string, public val: string) {
        super(null);
        this.attribs.value = this.key;
        this.setTag("option");
    }

    override preRender = (): boolean => {
        this.attribs.className = "selectOption";
        this.setChildren([this.val]);
        return true;
    }
}
