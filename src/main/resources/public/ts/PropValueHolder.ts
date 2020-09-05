import { Constants as C } from "./Constants";
import { ValueIntf } from "./Interfaces";
import { NodeInfo } from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/* encapsulates setting and getting a state variable property on behalf of a node */
export class PropValueHolder implements ValueIntf {

    constructor(private node: NodeInfo, private propName: string, defaultVal: string) {
        if (!this.getValue()) {
            this.setValue(defaultVal);
        }
    }

    setValue(val: string): void {
        S.props.setNodePropVal(this.propName, this.node, val);
    }

    getValue(): string {
        return S.props.getNodePropVal(this.propName, this.node);
    }
}
