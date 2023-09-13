import * as J from "./JavaIntf";

export class RpcQueueItem {
    public promise: Promise<J.ResponseBase>;
    public func: () => void;
    public info: string;
    public compId: string;
}
