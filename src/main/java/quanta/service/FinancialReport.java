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
import quanta.util.TL;

@Component 
public class FinancialReport extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(FinancialReport.class);

    public String getReport() {
        TL.requireAdmin();
        StringBuilder sb = new StringBuilder();

        sb.append(htmlH(6, "Credits"));
        sb.append(getStatsTable("C"));

        sb.append(htmlH(6, "Debits"));
        sb.append(getStatsTable("D"));

        sb.append(htmlH(6, "User Balances"));
        sb.append(getAllUserBalancesTable());

        sb.append(htmlH(6, "All Trans"));
        sb.append(getAllTransactionsTable());

        return sb.toString();
    }

    private String getAllUserBalancesTable() {
        List<Object[]> results = svc_tranRepo.findAllUserBalances();
        if (results == null || results.size() == 0) {
            return "No data available yet.";
        }
        return htmlTable(htmlHeader("User Name", "Balance") + //
                formatTableRows(results));
    }

    private String getAllTransactionsTable() {
        List<Object[]> results = svc_tranRepo.allTrans();
        if (results == null || results.size() == 0) {
            return "No data available yet.";
        }
        return htmlTable(htmlHeader("Trans ID", "Time", "User Name", "Code", "Amount") + //
                formatTableRows(results));
    }

    private String getStatsTable(String transType) {
        List<Object[]> results = svc_tranRepo.findTranSummaryByUser(transType);
        if (results == null || results.size() == 0) {
            return "No data available yet.";
        }

        return htmlTable(htmlHeader("User Name", "Code", "Count", "Total") + //
                formatTableRows(results));
    }
}
