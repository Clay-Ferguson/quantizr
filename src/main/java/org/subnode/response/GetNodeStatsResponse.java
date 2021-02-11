package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class GetNodeStatsResponse extends ResponseBase {
    private String stats;

    public String getStats() {
        return stats;
    }

    public void setStats(String stats) {
        this.stats = stats;
    }
}
