package quanta.service;

import java.io.IOException;
import java.text.DecimalFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import quanta.util.Util;

@Component
public class DataTransferRateFilter extends GenericFilterBean {

    private static Logger log = LoggerFactory.getLogger(DataTransferRateFilter.class);
    public static double totalBytesSent = 0;
    public static double totalTime = 0; // nano seconds

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        long startTime = System.nanoTime();
        chain.doFilter(request, response);
        long endTime = System.nanoTime();
        long duration = endTime - startTime; // Total execution time in nano seconds
        if (duration == 0)
            duration = 1;

        if (response instanceof HttpServletResponse) {
            HttpServletResponse httpServletResponse = (HttpServletResponse) response;
            int responseSize = httpServletResponse.getBufferSize();
            totalTime += duration;

            double dataRate = Util.calculateKBps(responseSize, duration);
            totalBytesSent += responseSize;
            DecimalFormat decimalFormat = new DecimalFormat("0.000");

            log.debug("Data Rate: " + decimalFormat.format(dataRate) + " KBps (Avg: "
                    + DataTransferRateFilter.formatAverageRate() + ")");
        }
    }

    public static String formatAverageRate() {
        DecimalFormat decimalFormat = new DecimalFormat("0.000");
        return decimalFormat.format(Util.calculateKBps(totalBytesSent, totalTime)) + " KBps";
    }
}
