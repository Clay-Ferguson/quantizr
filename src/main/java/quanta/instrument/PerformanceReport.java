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

	public static String getReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("Performance Report\n\n");

		// Sort list by whichever are consuming the most time (i.e. by duration, descending order)
		List<PerfMonEvent> orderedData;
		synchronized (Instrument.data) {
			if (Instrument.data.size() == 0) {
				sb.append("No methods have taken above the threshold time of " + Instrument.TIME_THRESHOLD + "ms");
				return sb.toString();
			}
			orderedData = new ArrayList<>(Instrument.data);
			orderedData.sort((s1, s2) -> (int) (s2.duration - s1.duration));
		}

		for (PerfMonEvent se : orderedData) {
			sb.append(ok(se.user) ? se.user : "anon");
			sb.append(" ");
			sb.append(se.event);
			sb.append(" ");
			sb.append(DateUtil.formatDurationMillis(se.duration, true));
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
}
