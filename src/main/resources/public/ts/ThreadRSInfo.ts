import { ResultSetInfo } from "./ResultSetInfo";
import * as J from "./JavaIntf";

export class ThreadRSInfo extends ResultSetInfo {
    topReached: boolean;
    others: J.NodeInfo[];
}
