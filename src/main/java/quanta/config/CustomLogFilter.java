package quanta.config;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.filter.Filter;
import ch.qos.logback.core.spi.FilterReply;

/*
 * Because of some bizarre reason I never fully figred out there are some classes (namely
 * 'reactor.*' at first) that `logback.xml` file alone is incapable of filtering out. This class is
 * a workaround for that.
 */
public class CustomLogFilter extends Filter<ILoggingEvent> {

    @Override
    public FilterReply decide(ILoggingEvent event) {
        if (event.getLoggerName().contains("reactor.")) {
            return FilterReply.DENY;
        }
        // All other events should be logged
        return FilterReply.NEUTRAL;
    }
}
