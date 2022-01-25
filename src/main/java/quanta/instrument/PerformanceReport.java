package quanta.instrument;

import static quanta.util.Util.ok;
import static quanta.util.Util.no;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.util.DateUtil;

public class PerformanceReport {
	private static final Logger log = LoggerFactory.getLogger(PerformanceReport.class);

	// Any calls that complete faster than this time, are not even considered. They're not a problem.
	public static final int REPORT_THRESHOLD = 1300; // 1300 for prod

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
		int counter = 0;
		for (PerfMonEvent se : orderedData) {
			if (se.duration > REPORT_THRESHOLD) {
				sb.append(formatEvent(se, counter++ < 20, false));
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
		sb.append("\nCall Counts: \n");
		for (UserPerf se : upiList) {
			sb.append(se.user);
			sb.append(" ");
			sb.append(se.totalCalls);
			sb.append("\n");
		}

		upiList.sort((s1, s2) -> (int) (s2.totalTime - s1.totalTime));
		sb.append("\nTime Usage: \n");
		for (UserPerf se : upiList) {
			sb.append(se.user);
			sb.append(" ");
			sb.append(DateUtil.formatDurationMillis(se.totalTime, true));
			sb.append("\n");
		}

		upiList.sort((s1, s2) -> (int) (s2.totalTime / s2.totalCalls - s1.totalTime / s1.totalCalls));
		sb.append("\nAvgerage Time Per Call: \n");
		for (UserPerf se : upiList) {
			sb.append(se.user);
			sb.append(" ");
			sb.append(DateUtil.formatDurationMillis(se.totalTime / se.totalCalls, true));
			sb.append("\n");
		}

		sb.append(getTimesPerCategory());

		return sb.toString();
	}

	static class MethodStat {
		String category;
		int totalTime;
		int totalCount;
	}

	/* This is the most 'powerful/useful' feature, because it displays time usage for each category */
	public static String getTimesPerCategory() {
		StringBuilder sb = new StringBuilder();
		HashMap<String, MethodStat> stats = new HashMap<>();
		sb.append("\nTimes Per Category\n");
		for (PerfMonEvent event : Instrument.data) {
			MethodStat stat = stats.get(event.event);
			if (no(stat)) {
				stats.put(event.event, stat = new MethodStat());
				stat.category = event.event;
			}
			stat.totalTime += event.duration;
			stat.totalCount++;
		}

		List<MethodStat> orderedStats = new ArrayList<>(stats.values());
		orderedStats.sort((s1, s2) -> (int) (s2.totalTime / s2.totalCount - s1.totalTime / s1.totalCount));

		for (MethodStat stat : orderedStats) {
			sb.append(stat.category);
			sb.append(" count=");
			sb.append(String.valueOf(stat.totalCount));
			sb.append(" avg=");
			sb.append(DateUtil.formatDurationMillis(stat.totalTime / stat.totalCount, true));
			sb.append("\n");
		}
		sb.append("\n");

		return sb.toString();
	}

	public static String formatEvent(PerfMonEvent se, boolean showSubEvents, boolean isSubItem) {
		StringBuilder sb = new StringBuilder();

		if (!isSubItem) {
			sb.append(ok(se.user) ? se.user : "anon");
			sb.append(" ");
		}
		sb.append(se.event);
		sb.append(" ");
		sb.append(DateUtil.formatDurationMillis(se.duration, true));

		if (!isSubItem && ok(se.root)) {
			sb.append(" r=");
			sb.append(se.root.hashCode());
		}

		sb.append(" e=");
		sb.append(se.hashCode());

		// If this event happens to be the head/root of a series of events
		if (showSubEvents && ok(se.root) && ok(se.root.subEvents)) {
			sb.append("\n  Set:\n");
			for (PerfMonEvent subEvent : se.root.subEvents) {
				// if we run across same 'se' we're processing, skip it
				if (subEvent != se) {
					sb.append("    ");
					sb.append(formatEvent(subEvent, false, true));
					sb.append("\n");
				}
			}
			sb.append("\n");
		}

		return sb.toString();
	}
}
