package quanta.instrument;

import java.util.LinkedList;
import java.util.List;
import quanta.util.ThreadLocals;
import static quanta.util.Util.no;

public class PerfMonEvent {

    public PerfMonEvent root;
    public List<PerfMonEvent> subEvents;

    // NO GETTERS/SETTERS. Not needed or wanted.
    public int duration;
    public String event;
    public String user;

    public PerfMonEvent(int duration, String event, String user) {
        this.duration = duration;
        this.event = event;
        this.user = user;
        
        Instrument.add(this);
        PerfMonEvent rootEvent = ThreadLocals.getRootEvent();

        // if there's no root event for this thread make this one the root.
        if (no(rootEvent)) {
            ThreadLocals.setRootEvent(this);
        }
        // else add this even to the subevents.
        else {
            // create lazily
            if (no(rootEvent.subEvents)) {
                rootEvent.subEvents = new LinkedList<>();
            }
            rootEvent.subEvents.add(this);
            root = rootEvent;
        }
    }
}
