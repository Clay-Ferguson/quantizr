import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class AIAgentType extends TypeBase {

    constructor() {
        super(J.NodeType.AI_AGENT, "AI Agent", "fa-robot", true);
    }

    override allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return true;
    }

    override getAllowContentEdit(): boolean {
        return true;
    }
}
