import { ValueIntf } from "./Interfaces";
import { CompIntf } from "./comp/base/CompIntf";

// encapsulates setting and getting a component state variable on behalf of a component
export class Value<T> implements ValueIntf {
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

    /* This is kind of confusing, but by convention we have the validation error for any property specified as the property
    of the same name that ends with ValidationError */
    getValidationError(): string {
        return this.comp.getState()[this.propName + "ValidationError"];
    }
}
