package org.subnode.filter;

import java.io.IOException;
import java.util.HashMap;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import org.subnode.util.Util;
import static org.subnode.util.Util.*;

@Component
@Order(3)
public class HitFilter extends GenericFilterBean {
	private static final Logger log = LoggerFactory.getLogger(HitFilter.class);

	private static final HashMap<String, Integer> uniqueIpHits = new HashMap<>();

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {

		HttpServletRequest sreq = null;
		if (request instanceof HttpServletRequest) {
			sreq = (HttpServletRequest) request;
			updateHitCounter(sreq);
		}

		chain.doFilter(request, response);
	}

	private void updateHitCounter(HttpServletRequest httpReq) {
		String ip = Util.getClientIpAddr(httpReq);

		synchronized (uniqueIpHits) {
			Integer hitCount = ok(ip) ? uniqueIpHits.get(ip) : null;

			if (no(hitCount)) {
				uniqueIpHits.put(ip, 1);
			} else {
				hitCount = hitCount.intValue() + 1;
				uniqueIpHits.put(ip, hitCount);
			}
		}
	}

	public static HashMap<String, Integer> getUniqueIpHits() {
		return uniqueIpHits;
	}

	public void destroy() {}
}
