import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { ValueIntf } from "./Interfaces";
import { NodeInfo } from "./JavaIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/* encapsulates setting and getting a state variable property on behalf of a node

todo-0: when I implemented this I totally forgot if the user clicks cancel these values
will stay set in the node anyway. This is a classic problem with binding a control
directly to some object, because you need to save a deep clone before editing starts
to either edit with that object and use it when 'save' is clicked, or else edit the real object
during edting but rollback to the clone if cancel is clicked. */
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
