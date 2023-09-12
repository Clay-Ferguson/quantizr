import { ValueIntf } from "./Interfaces";
import { NodeInfo } from "./JavaIntf";
import { S } from "./Singletons";

/* encapsulates setting and getting a state variable property on behalf of a node */
export class PropValueHolder implements ValueIntf {

    constructor(private node: NodeInfo, private propName: string, defaultVal: string) {
        if (!this.getValue()) {
            this.setValue(defaultVal);
        }
    }

    setValue(val: string): void {
        S.props.setPropVal(this.propName, this.node, val);
    }

    getValue(): string {
        return S.props.getPropStr(this.propName, this.node);
    }
}
