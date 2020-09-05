import { Constants as C } from "./Constants";
import { ValueIntf } from "./Interfaces";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { CompIntf } from "./widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

//encapsulates setting and getting a component state variable on behalf of a component
export class CompValueHolder<T> implements ValueIntf {

    constructor(private comp: CompIntf, public propName: string) {
    }

    setValue(val: T): void {
        let obj = {};
        obj[this.propName] = val || "";
        this.comp.mergeState(obj);
    }

    getValue(): T {
        return this.comp.getState()[this.propName];
    }
}
