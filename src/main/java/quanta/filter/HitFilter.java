package quanta.filter;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.IOException;
import java.util.HashMap;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import quanta.util.Util;

/**
 * Servlet filter for monitoring load statistics
 */
@Component
@Order(4)
public class HitFilter extends GenericFilterBean {
	private static final Logger log = LoggerFactory.getLogger(HitFilter.class);
	private static final HashMap<String, Integer> uniqueHits = new HashMap<>();

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {
		if (!Util.gracefulReadyCheck(response)) return;

		HttpServletRequest sreq = null;
		if (request instanceof HttpServletRequest) {
			sreq = (HttpServletRequest) request;
			updateHitCounter(sreq);
		}

		chain.doFilter(request, response);
	}

	private void updateHitCounter(HttpServletRequest httpReq) {
		HttpSession session = ((HttpServletRequest) httpReq).getSession(false);
		if (ok(session)) {
			addHit(session.getId());
		}
	}

	// Identifier can be a username OR a sessionId, depending on which map is being updated
	public static void addHit(String id) {
		synchronized (uniqueHits) {
			Integer hitCount = ok(id) ? uniqueHits.get(id) : null;

			if (no(hitCount)) {
				uniqueHits.put(id, 1);
			} else {
				hitCount = hitCount.intValue() + 1;

				// Throttle heavy users
				if (hitCount > 20) {
					Util.sleep(hitCount);
				}
				uniqueHits.put(id, hitCount);
			}
		}
	}

	public static HashMap<String, Integer> getHits() {
		return uniqueHits;
	}

	public void destroy() {}
}
