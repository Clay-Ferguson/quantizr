package quanta.util;

import java.sql.Timestamp;
import java.util.List;

public class HtmlUtil {
    public static String htmlH(int level, String heading) {
        return "<h" + String.valueOf(level) + " class='marginTop'>\n" + heading + "</h" + String.valueOf(level) + ">\n";
    }

    public static String htmlTable(String table) {
        return "<table>\n" + table + "</table>\n";
    }

    public static String htmlTr(String row) {
        return "<tr>\n" + row + "</tr>\n";
    }

    public static String htmlTd(String td) {
        return "<td>\n" + td + "</td>\n";
    }

    public static String htmlTdRt(String td) {
        return "<td align='right'>\n" + td + "</td>\n";
    }

    public static String htmlTh(String td) {
        return "<th>\n" + td + "</th>\n";
    }

    public static String htmlHeader2(String... headers) {
        return "";
    }

    public static String htmlHeader(String... headers) {
        StringBuilder sb = new StringBuilder();
        for (String header : headers) {
            sb.append(htmlTh(header));
        }
        return htmlTr(sb.toString());
    }

    public static String formatTableRows(List<Object[]> results) {
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
