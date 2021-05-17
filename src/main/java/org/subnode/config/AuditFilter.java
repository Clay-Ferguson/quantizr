package org.subnode.config;

import java.io.IOException;
import java.util.Enumeration;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;

/**
 * Servlet filter that intercepts calls coming into a server and logs all the
 * request info as well as all request and session parameters/attributes.
 */
// To enable, uncomment this annotation.
// @Component
public class AuditFilter extends GenericFilterBean {

	private static final Logger log = LoggerFactory.getLogger(AuditFilter.class);
	private static String INDENT = "    ";
	private static boolean verbose = false;

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {

		HttpServletRequest sreq = null;
		if (request instanceof HttpServletRequest) {
			sreq = (HttpServletRequest) request;
		}

		try {
			preProcess(sreq);
			chain.doFilter(request, response);
		} finally {
			if (verbose) {
				postProcess(sreq);
			}
		}
	}

	private String getConfigParamInfo() {
		StringBuilder sb = new StringBuilder();
		Enumeration<?> en = getFilterConfig().getInitParameterNames();
		if (en != null) {
			while (en.hasMoreElements()) {
				String param = (String) en.nextElement();
				sb.append(INDENT);
				sb.append(param);
				sb.append(": ");
				sb.append(getFilterConfig().getInitParameter(param));
				sb.append("\n");
			}
		}
		return sb.toString();
	}

	public static String getRequestInfo(HttpServletRequest sreq) {
		StringBuilder sb = new StringBuilder();
		sb.append("Request information:\n");
		sb.append(INDENT);
		sb.append("Request method: ");
		sb.append(sreq.getMethod());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Request URI: ");
		sb.append(sreq.getRequestURI());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Request protocol: ");
		sb.append(sreq.getProtocol());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Servlet path: ");
		sb.append(sreq.getServletPath());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Path info: ");
		sb.append(sreq.getPathInfo());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Path translated: ");
		sb.append(sreq.getPathTranslated());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Query string: ");
		sb.append(sreq.getQueryString());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Content length: ");
		sb.append(sreq.getContentLength());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Content type: ");
		sb.append(sreq.getContentType());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Server name: ");
		sb.append(sreq.getServerName());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Server port: ");
		sb.append(sreq.getServerPort());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Remote user: ");
		sb.append(sreq.getRemoteUser());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Remote address: ");
		sb.append(sreq.getRemoteAddr());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Remote host: ");
		sb.append(sreq.getRemoteHost());
		sb.append("\n");
		sb.append(INDENT);
		sb.append("Authorization scheme: ");
		sb.append(sreq.getAuthType());
		sb.append("\n");
		return sb.toString();
	}

	private String getHeaderInfo(HttpServletRequest sreq) {
		StringBuilder sb = new StringBuilder();
		Enumeration<?> e = sreq.getHeaderNames();
		if (e.hasMoreElements()) {
			sb.append("Request headers:\n");
			while (e.hasMoreElements()) {
				String name = (String) e.nextElement();
				sb.append(INDENT);
				sb.append(name);
				sb.append(": ");
				sb.append(sreq.getHeader(name));
				sb.append("\n");
			}
		}
		return sb.toString();
	}

	private String getParameterInfo(HttpServletRequest sreq) {
		StringBuilder sb = new StringBuilder();
		Enumeration<?> e = sreq.getParameterNames();
		if (e.hasMoreElements()) {
			sb.append("Servlet parameters (Multiple Value style):\n");
			while (e.hasMoreElements()) {
				String name = (String) e.nextElement();
				String vals[] = (String[]) sreq.getParameterValues(name);
				if (vals != null) {
					sb.append(INDENT);
					sb.append("[");
					sb.append(name);
					sb.append("] = ");
					sb.append(vals[0]);

					for (int i = 1; i < vals.length; i++) {
						sb.append(INDENT);
						sb.append(INDENT); // double indent (not a typo)
						sb.append(vals[i]);
						sb.append("\n");
					}
				}
				sb.append("\n");
			}
		}
		return sb.toString();
	}

	private String getAttributeInfo(HttpServletRequest sreq) {
		StringBuilder sb = new StringBuilder();
		Object reqAttrs = sreq.getAttributeNames();
		if (reqAttrs != null && reqAttrs instanceof Enumeration<?>) {
			Enumeration<?> attrs = (Enumeration<?>) reqAttrs;
			sb.append("Request Attributes\n");
			while (attrs.hasMoreElements()) {
				String attr = attrs.nextElement().toString();
				if (sreq.getAttribute(attr) != null) {
					sb.append(INDENT);
					sb.append(attr);
					sb.append(" = ");
					sb.append(sreq.getAttribute(attr).toString());
				} else {
					sb.append(INDENT);
					sb.append(attr);
					sb.append(" = NULL");
				}
				sb.append("\n");
			}
		}
		return sb.toString();
	}

	private String getSessionAttributeInfo(HttpServletRequest sreq) {
		StringBuilder sb = new StringBuilder();
		HttpSession session = ((HttpServletRequest) sreq).getSession(true);
		Object sessionAattrs = session.getAttributeNames();
		if (sessionAattrs != null && sessionAattrs instanceof Enumeration<?>) {
			Enumeration<?> attrs = (Enumeration<?>) sessionAattrs;
			sb.append("Session Attributes\n");
			while (attrs.hasMoreElements()) {
				String attr = attrs.nextElement().toString();
				if (session.getAttribute(attr) != null) {
					sb.append(INDENT);
					sb.append(attr);
					sb.append(" = ");
					sb.append(session.getAttribute(attr).toString());
				} else {
					sb.append(INDENT);
					sb.append(attr);
					sb.append(" = NULL");
				}
				sb.append("\n");
			}
		}
		return sb.toString();
	}

	@SuppressWarnings("unused")
	private String getRequestParameterInfo(HttpServletRequest sreq) {
		Enumeration<?> e = sreq.getParameterNames();
		StringBuilder sb = new StringBuilder();

		if (e.hasMoreElements()) {
			sb.append("Servlet parameters (Single Value style):\n");
			while (e.hasMoreElements()) {
				String name = (String) e.nextElement();
				sb.append(INDENT + name + " = " + sreq.getParameter(name) + "\n");
			}
		}

		return sb.toString();
	}

	private void preProcess(HttpServletRequest sreq) {
		if (sreq == null)
			return;

		if (!verbose) {
			StringBuilder sb = new StringBuilder();
			sb.append("REQ: ");
			sb.append(sreq.getMethod());
			sb.append(" ");
			sb.append(sreq.getRequestURI());
			if (sreq.getQueryString() != null) {
				sb.append(" -> ");
				sb.append(sreq.getQueryString());
			}
			sb.append(" [from ");
			sb.append(sreq.getRemoteAddr());
			sb.append("]");
			log.debug(sb.toString());
			return;
		}

		try {
			StringBuilder sb = new StringBuilder();
			sb.append("PRE REQ INFO:\n");
			sb.append(getConfigParamInfo());
			sb.append(getRequestInfo(sreq));
			sb.append(getRequestParameterInfo(sreq));
			sb.append(getHeaderInfo(sreq));
			sb.append(getParameterInfo(sreq));
			sb.append(getAttributeInfo(sreq));
			sb.append(getSessionAttributeInfo(sreq));
			log.debug(sb.toString());
		} catch (Exception e) {
			log.error("error", e);
		}
	}

	private void postProcess(HttpServletRequest sreq) {
		try {
			if (sreq == null)
				return;
			StringBuilder sb = new StringBuilder();
			sb.append("POST REQ INFO:\n");
			sb.append(getSessionAttributeInfo(sreq));
			log.debug(sb.toString());
		} catch (Exception e) {
			log.error("error", e);
		}
	}

	public void destroy() {
	}
}
