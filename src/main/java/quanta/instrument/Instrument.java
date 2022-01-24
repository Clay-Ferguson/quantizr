package quanta.instrument;

import static quanta.util.Util.ok;
import java.util.Collections;
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
	public static final int TIME_THRESHOLD = 1000;

	private static final int MAX_EVENTS = 10000;
	public static List<PerfMonEvent> data = Collections.synchronizedList(new LinkedList());

	// Wrap PerfMon (PerformanceMonitor) methods.
	@Around("execution(@PerfMon * *(..))")
	public Object perfMonAdvice(ProceedingJoinPoint jp) throws Throwable {
		if (data.size() > MAX_EVENTS) {
			data.clear();
		}

		Object value = null;
		long startTime = System.currentTimeMillis();
		String userName = null;
		try {
			SessionContext sc = ThreadLocals.getSC();
			if (ok(sc) && !PrincipalName.ANON.s().equals(sc.getUserName())) {
				userName = sc.getUserName();
			}

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
				data.add(event);
			}
		}
		return value;
	}
}
