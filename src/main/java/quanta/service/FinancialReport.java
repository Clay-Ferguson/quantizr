package quanta.service;

import static quanta.util.HtmlUtil.formatTableRows;
import static quanta.util.HtmlUtil.htmlH;
import static quanta.util.HtmlUtil.htmlHeader;
import static quanta.util.HtmlUtil.htmlTable;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.util.ThreadLocals;

@Component
public class FinancialReport extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(FinancialReport.class);

    public String getReport() {
        ThreadLocals.requireAdmin();
        StringBuilder sb = new StringBuilder();

        sb.append(htmlH(6, "Credits"));
        sb.append(getStatsTable("C"));

        sb.append(htmlH(6, "Debits"));
        sb.append(getStatsTable("D"));

        sb.append(htmlH(6, "All Trans"));
        sb.append(getAllTransactionsTable());

        return sb.toString();
    }

    private String getAllTransactionsTable() {
        List<Object[]> results = tranRepository.allTrans();
        if (results == null || results.size() == 0) {
            return "No data available yet.";
        }
        return htmlTable(htmlHeader("Trans ID", "Time", "User ID", "User Name", "Code", "Amount") + //
                formatTableRows(results));
    }

    private String getStatsTable(String transType) {
        List<Object[]> results = tranRepository.findTranSummaryByUser(transType);
        if (results == null || results.size() == 0) {
            return "No data available yet.";
        }

        return htmlTable(htmlHeader("User ID", "User Name", "Code", "Count", "Total", "Avg") + //
                formatTableRows(results));
    }
}
