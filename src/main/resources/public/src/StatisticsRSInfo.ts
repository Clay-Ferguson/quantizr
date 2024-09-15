import { ResultSetInfo } from "./ResultSetInfo";
import * as J from "./JavaIntf";

export class StatisticsRSInfo extends ResultSetInfo {
    public res: J.GetNodeStatsResponse;
    public filter: string;
}
