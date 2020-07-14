import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { ValueIntf } from "./Interfaces";
import { NodeInfo } from "./JavaIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/* encapsulates setting and getting a state variable property on behalf of a node */
export class PropValueHolder implements ValueIntf {

    constructor(private node: NodeInfo, private propName: string) {
    }

    setValue(val: string): void {
        S.props.setNodePropVal(this.propName, this.node, val);
    }

    getValue(): string {
        return S.props.getNodePropVal(this.propName, this.node);
    }
}
