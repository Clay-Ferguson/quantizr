import { ResultSetInfo } from "./ResultSetInfo";
import * as J from "./JavaIntf";

export class TrendingRSInfo extends ResultSetInfo {
    public res: J.GetNodeStatsResponse;
    public filter: string;
}
