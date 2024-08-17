package quanta.perf;

import static quanta.util.HtmlUtil.htmlH;
import static quanta.util.HtmlUtil.htmlHeader;
import static quanta.util.HtmlUtil.htmlTable;
import static quanta.util.HtmlUtil.htmlTd;
import static quanta.util.HtmlUtil.htmlTdRt;
import static quanta.util.HtmlUtil.htmlTr;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.model.client.PrincipalName;
import quanta.service.DataTransferRateFilter;
import quanta.util.DateUtil;
import quanta.util.TL;
import quanta.util.Util;

public class PerformanceReport {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(PerformanceReport.class);

    public static String clearData() {
        TL.requireAdmin();
        synchronized (PerfData.data) {
            PerfData.data.clear();
        }
        DataTransferRateFilter.reset();
        return getReport();
    }

    public static String getReport() {
        TL.requireAdmin();
        StringBuilder sb = new StringBuilder();

        DecimalFormat decimalFormat = new DecimalFormat("0.000");
        sb.append(htmlH(6,
                "Data: " + decimalFormat.format(
                        Util.calculateKBps(DataTransferRateFilter.totalBytesSent, DataTransferRateFilter.totalTime))
                        + " KBps"));

        // Sort list by whichever are consuming the most time (i.e. by duration, descending order)
        List<PerfEvent> orderedData;
        synchronized (PerfData.data) {
            if (PerfData.data.size() == 0) {
                sb.append("No data available yet.");
                return sb.toString();
            }
            orderedData = new ArrayList<>(PerfData.data);
            orderedData.sort((s1, s2) -> (int) (s2.duration - s1.duration));
        }

        String rows = "";
        for (PerfEvent se : orderedData) {
            rows += formatEvent(se);
        }

        if (!rows.isEmpty()) {
            sb.append(htmlH(3, "Slow Ops"));
            sb.append(htmlTable(htmlHeader("User", "Event", "Time") + rows));
        }
        // calculate totals per person
        HashMap<String, UserPerf> userPerfInfo = new HashMap<>();

        for (PerfEvent se : orderedData) {
            String user = se.user != null ? se.user : PrincipalName.ANON.s();
            UserPerf up = userPerfInfo.get(user);
            if (up == null) {
                userPerfInfo.put(user, up = new UserPerf());
                up.user = user;
            }
            up.totalCalls++;
            up.totalTime += se.duration;
        }
        List<UserPerf> upiList = new ArrayList<>(userPerfInfo.values());
        upiList.sort((s1, s2) -> (int) (s2.totalCalls - s1.totalCalls));
        // -------------------------------------------
        sb.append(htmlH(3, "Call Counts"));
        rows = "";

        for (UserPerf se : upiList) {
            rows += htmlTr(htmlTd(se.user) + htmlTdRt(String.valueOf(se.totalCalls)));
        }
        if (!rows.isEmpty()) {
            sb.append(htmlTable(htmlHeader("user", "Count") + rows));
        }
        // -------------------------------------------
        upiList.sort((s1, s2) -> (int) (s2.totalTime - s1.totalTime));
        sb.append(htmlH(3, "Time Usage by User"));
        rows = "";

        for (UserPerf se : upiList) {
            rows += htmlTr(htmlTd(se.user) + htmlTdRt(DateUtil.formatDurationMillis(se.totalTime, true)));
        }
        if (!rows.isEmpty()) {
            sb.append(htmlTable(htmlHeader("user", "Total Time") + rows));
        }
        // -------------------------------------------
        upiList.sort((s1, s2) -> (int) (s2.totalTime / s2.totalCalls - s1.totalTime / s1.totalCalls));
        sb.append(htmlH(3, "Avg Time Per Call"));
        rows = "";

        for (UserPerf se : upiList) {
            rows += htmlTr(
                    htmlTd(se.user) + htmlTdRt(DateUtil.formatDurationMillis(se.totalTime / se.totalCalls, true)));
        }
        if (!rows.isEmpty()) {
            sb.append(htmlTable(htmlHeader("user", "Avg Time") + rows));
        }
        sb.append(getTimesPerCategory());
        return sb.toString();
    }

    static class MethodStat {
        String category;
        int totalTime;
        int totalCount;
    }

    // This is the most 'powerful/useful' feature, because it displays time usage for each category
    public static String getTimesPerCategory() {
        HashMap<String, MethodStat> stats = new HashMap<>();

        for (PerfEvent event : PerfData.data) {
            MethodStat stat = stats.get(event.event);
            if (stat == null) {
                stats.put(event.event, stat = new MethodStat());
                stat.category = event.event;
            }
            stat.totalTime += event.duration;
            stat.totalCount++;
        }
        List<MethodStat> orderedStats = new ArrayList<>(stats.values());
        orderedStats.sort((s1, s2) -> (int) (s2.totalTime / s2.totalCount - s1.totalTime / s1.totalCount));
        String table = htmlHeader("Category", "Count", "Avg. Time", "Time");

        for (MethodStat stat : orderedStats) {
            table += htmlTr(htmlTd(stat.category) + htmlTdRt(String.valueOf(stat.totalCount))
                    + htmlTdRt(DateUtil.formatDurationMillis(stat.totalTime / stat.totalCount, true)) + //
                    htmlTdRt(DateUtil.formatDurationMillis(stat.totalTime, true)));
        }
        return htmlH(3, "Times Per Category") + htmlTable(table);
    }

    public static String formatEvent(PerfEvent se) {
        String tr = "";
        tr += htmlTd(se.user != null ? se.user : PrincipalName.ANON.s());
        tr += htmlTd(se.event);
        tr += htmlTdRt(DateUtil.formatDurationMillis(se.duration, true));
        return htmlTr(tr);
    }
}
