package quanta.instrument;

import static quanta.util.Util.ok;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.SessionContext;
import quanta.model.client.PrincipalName;
import quanta.util.DateUtil;
import quanta.util.ThreadLocals;

/*
 * Instrumentation for the app (for Performance Monitoring)
 * 
 * Any method can be annotated with @PerfMon to gather performance statistics but mainly we just do
 * this on our external-facing REST controller interface.
 * 
 * Eventually we can perhaps use OpenTelemetry+SigNoz for performance metrics, but for now to be
 * able to gather specific targeted metrics in the simplest way possible, we just use this class
 * internally in the app rather than more complex approaches, since we were able to implement this
 * letting AOP do all the work, and since perfMonAdvice() method below is so trivial.
 */
@Aspect
@Component
public class Instrument {
	private static final Logger log = LoggerFactory.getLogger(Instrument.class);

	// Any calls that complete faster than this time, are not even considered. They're not a problem.
	private static final int TIME_THRESHOLD = 1000;

	private static final int MAX_EVENTS = 10000;
	private static List<PerfMonEvent> stopwatchData = Collections.synchronizedList(new LinkedList());

	// Wrap PerfMon (PerformanceMonitor) methods.
	@Around("execution(@PerfMon * *(..))")
	public Object perfMonAdvice(ProceedingJoinPoint jp) throws Throwable {
		if (stopwatchData.size() > MAX_EVENTS) {
			stopwatchData.clear();
		}

		Object value = null;
		long startTime = System.currentTimeMillis();
		String userName = null;
		try {
			SessionContext sc = ThreadLocals.getSC();
			if (ok(sc) && !PrincipalName.ANON.s().equals(sc.getUserName())) {
				userName = sc.getUserName();
			}

			// log.debug(jp.getSignature().getName() + "-" + userName);
			value = jp.proceed();
		} catch (Throwable e) {
			throw e;
		} finally {
			int duration = (int) (System.currentTimeMillis() - startTime);

			if (duration > TIME_THRESHOLD) {
				PerfMonEvent event = new PerfMonEvent();
				event.duration = duration;
				event.event = jp.getSignature().getName();
				event.user = userName;
				stopwatchData.add(event);
			}
		}
		return value;
	}

	/*
	 * todo-0: Move this out into InstrumentReport.java. The only purpose of this baseline report is to
	 * get visibility of bottlenecks.
	 */
	public static String getPerformancerReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("Performance Report\n\n");

		// Sort list by whichever are consuming the most time (i.e. by duration, descending order)
		List<PerfMonEvent> orderedData;
		synchronized (stopwatchData) {
			orderedData = new ArrayList<>(stopwatchData);
			orderedData.sort((s1, s2) -> (int) (s2.duration - s1.duration));
		}

		for (PerfMonEvent se : orderedData) {
			sb.append(ok(se.user) ? se.user : "anon");
			sb.append(" ");
			sb.append(se.event);
			sb.append(" ");
			sb.append(DateUtil.formatDurationMillis(se.duration));
			sb.append("\n");
		}

		// totals per person
		HashMap<String, UserPerf> userPerfInfo = new HashMap<>();
		for (PerfMonEvent se : orderedData) {
			String user = ok(se.user) ? se.user : "anon";
			UserPerf up = userPerfInfo.get(user);
			if (up == null) {
				userPerfInfo.put(user, up = new UserPerf());
				up.user = user;
			}
			up.totalCalls++;
			up.totalTime += se.duration;
		}

		List<UserPerf> upiList = new ArrayList<>(userPerfInfo.values());

		upiList.sort((s1, s2) -> (int) (s2.totalCalls - s1.totalCalls));
		sb.append("\n\nCall Counts: \n");
		for (UserPerf se : upiList) {
			sb.append(se.user);
			sb.append(" ");
			sb.append(se.totalCalls);
			sb.append("\n");
		}

		upiList.sort((s1, s2) -> (int) (s2.totalTime - s1.totalTime));
		sb.append("\n\nTime Usage: \n");
		for (UserPerf se : upiList) {
			sb.append(se.user);
			sb.append(" ");
			sb.append(DateUtil.formatDurationMillis(se.totalTime));
			sb.append("\n");
		}

		upiList.sort((s1, s2) -> (int) (s2.totalTime / s2.totalCalls - s1.totalTime / s1.totalCalls));
		sb.append("\n\nAvgerage Time Per Call: \n");
		for (UserPerf se : upiList) {
			sb.append(se.user);
			sb.append(" ");
			sb.append(DateUtil.formatDurationMillis(se.totalTime / se.totalCalls));
			sb.append("\n");
		}

		return sb.toString();
	}
}
