package quanta.perf;

import java.util.Collections;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
 
public class PerfData {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(PerfData.class);
    private static final int MAX_EVENTS = 10000;
    public static List<PerfEvent> data = Collections.synchronizedList(new LinkedList<>());

    public static void add(PerfEvent event) {
        if (data.size() > MAX_EVENTS) {
            // remove oldest thing in the data cache once it fills up
            data.remove(0);
        }
        data.add(event);
    }
}
