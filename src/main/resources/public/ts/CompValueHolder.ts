import { ValueIntf } from "./Interfaces";
import { CompIntf } from "./widget/base/CompIntf";

//encapsulates setting and getting a component state variable on behalf of a component
export class CompValueHolder<T> implements ValueIntf {

    constructor(private comp: CompIntf, public propName: string) {
    }

    setValue(val: T): void {
        const obj = {};
        obj[this.propName] = val || "";
        this.comp.mergeState(obj);
    }

    getValue(): T {
        return this.comp.getState()[this.propName];
    }
}
