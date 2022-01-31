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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import quanta.util.ThreadLocals;
import quanta.util.Util;

/**
 * Servlet filter for monitoring load statistics
 */
@Component
@Order(4)
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
		ThreadLocals.setIp(Util.getClientIpAddr(httpReq));
		addHit(uniqueIpHits);
	}

	public static void addHit(HashMap<String, Integer> hashMap) {
		String ip = ThreadLocals.getIp();
		if (no(ip)) return;

		synchronized (hashMap) {
			Integer hitCount = ok(ip) ? hashMap.get(ip) : null;

			if (no(hitCount)) {
				hashMap.put(ip, 1);
			} else {
				hitCount = hitCount.intValue() + 1;
				hashMap.put(ip, hitCount);
			}
		}
	}

	public static HashMap<String, Integer> getUniqueIpHits() {
		return uniqueIpHits;
	}

	public void destroy() {}
}
