package quanta.service;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.text.DecimalFormat;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import quanta.util.Util;
import quanta.util.XString;

@Component
public class DataTransferRateFilter extends GenericFilterBean {
    private static Logger log = LoggerFactory.getLogger(DataTransferRateFilter.class);
    public static double totalBytesSent = 0;
    public static double totalTime = 0; // nano seconds

    /**
     * Filters the request and response to measure the data transfer rate.
     *
     * @param request the ServletRequest object that contains the client's request
     * @param response the ServletResponse object that contains the filter's response
     * @param chain the FilterChain for invoking the next filter or the resource
     * @throws IOException if an I/O error occurs during the filtering process
     * @throws ServletException if a servlet error occurs during the filtering process
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletResponse originalResponse = (HttpServletResponse) response;
        CountingResponseWrapper responseWrapper = new CountingResponseWrapper(originalResponse);

        String prefix = getLogPrefix((HttpServletRequest) request);
        long startTime = System.nanoTime();
        chain.doFilter(request, responseWrapper);
        long responseSize = responseWrapper.getByteCount();
        long endTime = System.nanoTime();
        long duration = endTime - startTime;
        if (duration == 0)
            duration = 1;

        if (response instanceof HttpServletResponse) {
            totalTime += duration;
            double dataRate = Util.calculateKBps(responseSize, duration);
            totalBytesSent += responseSize;
            DecimalFormat decimalFormat = new DecimalFormat("0.000");
            double seconds = duration / 1e9; // 1e9 is 1 billion

            // log any slow requests
            if (seconds > 1) {
                log.debug(prefix + "\n    Data Rate: " + decimalFormat.format(dataRate) + " KBps, Bytes: "
                        + responseSize + " (Avg: " + DataTransferRateFilter.formatAverageRate() + ")");
            }
        }
    }

    private String getLogPrefix(HttpServletRequest httpReq) {
        String prefix = "URI=" + httpReq.getRequestURI();
        if (httpReq.getQueryString() != null) {
            prefix += " q=" + httpReq.getQueryString();
        }
        Map<?, ?> params = httpReq.getParameterMap();
        if (params != null && params.size() > 0) {
            prefix += "\n    Params: " + XString.prettyPrint(httpReq.getParameterMap());
        }
        return prefix;
    }

    public static String formatAverageRate() {
        DecimalFormat decimalFormat = new DecimalFormat("0.000");
        return decimalFormat.format(Util.calculateKBps(totalBytesSent, totalTime)) + " KBps";
    }

    private static class CountingResponseWrapper extends HttpServletResponseWrapper {
        private CountingServletOutputStream outputStream;
        private PrintWriter writer;

        public CountingResponseWrapper(HttpServletResponse response) throws IOException {
            super(response);
            outputStream = new CountingServletOutputStream(response.getOutputStream());
        }

        @Override
        public ServletOutputStream getOutputStream() throws IOException {
            return outputStream;
        }

        @Override
        public PrintWriter getWriter() throws IOException {
            if (writer == null) {
                writer = new PrintWriter(new OutputStreamWriter(outputStream, getCharacterEncoding()));
            }
            return writer;
        }

        public long getByteCount() {
            return outputStream.getByteCount();
        }
    }

    private static class CountingServletOutputStream extends ServletOutputStream {
        private ServletOutputStream original;
        private AtomicLong count = new AtomicLong();

        @SuppressWarnings("unused")
        private WriteListener writeListener;

        public CountingServletOutputStream(ServletOutputStream original) {
            this.original = original;
        }

        @Override
        public boolean isReady() {
            return original.isReady();
        }

        @Override
        public void setWriteListener(WriteListener writeListener) {
            this.writeListener = writeListener;
            original.setWriteListener(writeListener);
        }

        @Override
        public void write(int b) throws IOException {
            count.incrementAndGet();
            original.write(b);
        }

        public long getByteCount() {
            return count.get();
        }
    }

    public static void reset() {
        totalBytesSent = 0;
        totalTime = 0;
    }
}
