package quanta.filter;

import static quanta.util.Util.ok;
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
import quanta.actpub.APConst;
import quanta.config.SessionContext;
import quanta.util.ThreadLocals;

/**
 * Global Servlet filter for cross-cutting concerns across all endpoints
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

		try {
			ThreadLocals.removeAll();
			HttpServletRequest sreq = null;
			if (request instanceof HttpServletRequest) {
				sreq = (HttpServletRequest) request;
				boolean createSession = true;

				// Special checks for Cache-Controls
				if (sreq.getRequestURI().contains("/images/") || //
						sreq.getRequestURI().contains("/fonts/") || //
						sreq.getRequestURI().contains("/dist/main.") || // JS bundle file
						sreq.getRequestURI().endsWith("/images/favicon.ico") || //
						// This is the tricky one. If we have versioned the URL we detect it this hacky way also picking up
						// v param.
						sreq.getRequestURI().contains("?v=")) {
					createSession = false;
					((HttpServletResponse) response).setHeader("Cache-Control", "public, must-revalidate, max-age=31536000");
				}

				// Special check for CORS
				if (sreq.getRequestURI().contains(APConst.PATH_WEBFINGER) || //
						sreq.getRequestURI().contains(APConst.PATH_AP + "/")) {
					createSession = false;
					((HttpServletResponse) response).setHeader("Access-Control-Allow-Origin", "*");
				}

				// NOTE: this is new logic! We used to create session always here.
				HttpSession session = sreq.getSession(createSession);
				if (ok(session)) {
					SessionContext.init(context, session, false);
				}
			}
			// log.debug("GlobalFilter->doFilter");
			chain.doFilter(request, response);
		} finally {
			/* Set thread back to clean slate, for it's next cycle time in threadpool */
			ThreadLocals.removeAll();
		}
	}

	public void destroy() {}
}
