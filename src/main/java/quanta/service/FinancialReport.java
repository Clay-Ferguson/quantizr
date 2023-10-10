package quanta.service;

import static quanta.util.HtmlUtil.htmlH;
import static quanta.util.HtmlUtil.htmlHeader;
import static quanta.util.HtmlUtil.htmlTable;
import static quanta.util.HtmlUtil.htmlTd;
import static quanta.util.HtmlUtil.htmlTdRt;
import static quanta.util.HtmlUtil.htmlTr;
import java.sql.Timestamp;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.util.DateUtil;
import quanta.util.ThreadLocals;

@Component
public class FinancialReport extends ServiceBase {

    private static Logger log = LoggerFactory.getLogger(FinancialReport.class);

    public String getReport() {
        ThreadLocals.requireAdmin();
        StringBuilder sb = new StringBuilder();

        sb.append(htmlH(6, "Credits"));
        sb.append(getStatsTable("C"));

        sb.append(htmlH(6, "Debits"));
        sb.append(getStatsTable("D"));

        sb.append(htmlH(6, "All Transactions"));
        sb.append(getAllTransactionsTable());

        return sb.toString();
    }

    private String getAllTransactionsTable() {
        StringBuilder sb = new StringBuilder();
        List<Object[]> results = transactionRepository.allTransactions();
        if (results == null || results.size() == 0) {
            sb.append("No data available yet.");
            return sb.toString();
        }

        String rows = formatTableRow(results);
        sb.append(htmlTable(htmlHeader("Time", "User ID", "User Name", "Code", "Amount") + rows));
        return sb.toString();
    }

    private String getStatsTable(String transType) {
        StringBuilder sb = new StringBuilder();
        List<Object[]> results = transactionRepository.findTransactionSummaryByUser(transType);
        if (results == null || results.size() == 0) {
            sb.append("No data available yet.");
            return sb.toString();
        }

        String rows = formatTableRow(results);
        sb.append(htmlTable(htmlHeader("User ID", "User Name", "Code", "Count", "Total", "Avg") + rows));
        return sb.toString();
    }

    private String formatTableRow(List<Object[]> results) {
        StringBuilder rows = new StringBuilder();

        // iterate over the results
        for (Object[] row : results) {
            StringBuilder r = new StringBuilder();

            // iterate over the columns
            for (Object col : row) {
                // string columns left justify
                if (col instanceof String) {
                    r.append(htmlTd(String.valueOf(col)));
                }
                // date columns left justify and format
                else if (col instanceof Timestamp t) {
                    r.append(htmlTd(DateUtil.standardFormatDateFromUTC(t.getTime())));
                }
                // anything else is numeric and right justified
                else {
                    r.append(htmlTdRt(String.valueOf(col)));
                }
            }
            rows.append(htmlTr(r.toString()));
        }
        return rows.toString();
    }
}
