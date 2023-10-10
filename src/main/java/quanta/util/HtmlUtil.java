package quanta.util;

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
}
