package quanta.config;

import org.springframework.context.ApplicationEvent;

public class AppStartupEvent extends ApplicationEvent {

    public AppStartupEvent() {
        super("AppStartupEvent Payload");
    }
}
