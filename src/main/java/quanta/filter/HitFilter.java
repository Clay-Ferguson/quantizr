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
			addHit(uniqueHits, session.getId());
		}
	}

	// Identifier can be a username OR a sessionId, depending on which map is being updated
	public static void addHit(HashMap<String, Integer> hashMap, String id) {
		synchronized (hashMap) {
			Integer hitCount = ok(id) ? hashMap.get(id) : null;

			if (no(hitCount)) {
				hashMap.put(id, 1);
			} else {
				hitCount = hitCount.intValue() + 1;
				hashMap.put(id, hitCount);
			}
		}
	}

	public static HashMap<String, Integer> getHits() {
		return uniqueHits;
	}

	public void destroy() {}
}
