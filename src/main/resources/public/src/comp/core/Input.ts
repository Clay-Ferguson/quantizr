import { State } from "../../State";
import { Comp } from "../base/Comp";

interface LS { // Local State
    value: string;
}

export class Input extends Comp {

    constructor(attribs: any = {}, s?: State) {
        super(attribs, s || new State());

        this.attribs.onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
            this.mergeState<LS>({ value: evt.target.value });
        };
        this.setTag("input");
    }

    override preRender = (): boolean => {
        this.attribs.value = this.getState<LS>().value || "";
        return true;
    }
}
