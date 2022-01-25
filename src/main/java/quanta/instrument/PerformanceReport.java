package quanta.instrument;

import static quanta.util.Util.ok;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.util.DateUtil;

public class PerformanceReport {
	private static final Logger log = LoggerFactory.getLogger(PerformanceReport.class);

	// Any calls that complete faster than this time, are not even considered. They're not a problem.
	public static final int REPORT_THRESHOLD = 1000;

	public static String getReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("Performance Report\n");

		// Sort list by whichever are consuming the most time (i.e. by duration, descending order)
		List<PerfMonEvent> orderedData;
		synchronized (Instrument.data) {
			if (Instrument.data.size() == 0) {
				sb.append("No data available yet.");
				return sb.toString();
			}
			orderedData = new ArrayList<>(Instrument.data);
			orderedData.sort((s1, s2) -> (int) (s2.duration - s1.duration));
		}

		sb.append("\nEvents over Threshold of " + String.valueOf(REPORT_THRESHOLD) + ": \n");
		for (PerfMonEvent se : orderedData) {
			if (se.duration > REPORT_THRESHOLD) {
				sb.append(formatEvent(se, true, true));
				sb.append("\n");
			}
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
			sb.append(DateUtil.formatDurationMillis(se.totalTime, true));
			sb.append("\n");
		}

		upiList.sort((s1, s2) -> (int) (s2.totalTime / s2.totalCalls - s1.totalTime / s1.totalCalls));
		sb.append("\n\nAvgerage Time Per Call: \n");
		for (UserPerf se : upiList) {
			sb.append(se.user);
			sb.append(" ");
			sb.append(DateUtil.formatDurationMillis(se.totalTime / se.totalCalls, true));
			sb.append("\n");
		}

		return sb.toString();
	}

	public static String formatEvent(PerfMonEvent se, boolean showSubEvents, boolean printRoot) {
		StringBuilder sb = new StringBuilder();
		sb.append(ok(se.user) ? se.user : "anon");
		sb.append(" ");
		sb.append(se.event);
		sb.append(" ");
		sb.append(DateUtil.formatDurationMillis(se.duration, true));

		if (printRoot && ok(se.root)) {
			sb.append(" r=");
			sb.append(se.root.hashCode());
		}

		sb.append(" e=");
		sb.append(se.hashCode());

		// This is not needed. We can search for the root id and tie together the info that way without dumping
		// this massive amount of data on each one.
		// // If this event happens to be the head/root of a series of events
		// if (showSubEvents && ok(se.root) && ok(se.root.subEvents)) {
		// 	sb.append("\n  Set:\n");
		// 	for (PerfMonEvent subEvent : se.root.subEvents) {
		// 		// if we run across same 'se' we're processing, skip it
		// 		if (subEvent != se) {
		// 			sb.append("    ");
		// 			sb.append(formatEvent(subEvent, false, false));
		// 			sb.append("\n");
		// 		}
		// 	}
		// 	sb.append("\n");
		// }

		return sb.toString();
	}
}
