package quanta.instrument;

import java.util.Collections;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
 
public class PerfMon {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(PerfMon.class);
    public static final int CAPTURE_THRESHOLD = 10; // 10 for prod
    private static final int MAX_EVENTS = 10000;
    public static List<PerfMonEvent> data = Collections.synchronizedList(new LinkedList<>());

    public static void add(PerfMonEvent event) {
        if (data.size() > MAX_EVENTS) {
            // remove oldest thing in the data cache once it fills up
            data.remove(0);
        }
        data.add(event);
    }
}
