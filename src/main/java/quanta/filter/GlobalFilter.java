package quanta.filter;

import java.io.IOException;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import quanta.config.SessionContext;

/**
 * Global Servlet filter for cross-cutting concerns across all web requests
 */
@Component
@Order(2)
public class GlobalFilter extends GenericFilterBean {
	private static final Logger log = LoggerFactory.getLogger(GlobalFilter.class);

	@Autowired
	private ApplicationContext context;

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {

		HttpServletRequest sreq = null;
		if (request instanceof HttpServletRequest) {
			sreq = (HttpServletRequest) request;

			HttpSession session = sreq.getSession(true);
			SessionContext.init(context, session);

			// Special checks for Cache-Controls
			if (sreq.getRequestURI().contains("/images/") || //
					sreq.getRequestURI().contains("/fonts/") || //
					sreq.getRequestURI().endsWith("/bundle.js") || //
					sreq.getRequestURI().endsWith("/images/favicon.ico") || //
					// This is the tricky one. If we have versioned the URL we detect it this hacky way also picking up
					// v param.
					sreq.getRequestURI().contains("?v=")) {
				((HttpServletResponse) response).setHeader("Cache-Control", "public, must-revalidate, max-age=31536000");
			}

			// Special check for CORS
			if (sreq.getRequestURI().contains("/.well-known/") || //
					sreq.getRequestURI().contains("/ap/")) {
				((HttpServletResponse) response).setHeader("Access-Control-Allow-Origin", "*");
			}
		}
		chain.doFilter(request, response);
	}

	public void destroy() {}
}
