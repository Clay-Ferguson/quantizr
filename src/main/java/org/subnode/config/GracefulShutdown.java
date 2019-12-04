package org.subnode.config;

public class GracefulShutdown {
/*
implements TomcatConnectorCustomizer, ApplicationListener<ContextClosedEvent> {
    private static final Logger log = LoggerFactory.getLogger(GracefulShutdown.class);
    
    private volatile Connector connector;
    @Override
    public void customize(Connector connector) {
        this.connector = connector;
    }
    @Override
    public void onApplicationEvent(ContextClosedEvent event) {
        log.debug("GracefulShutdown ContextClosedEvent. Pausing connector.");
        this.connector.pause();
        Executor executor = this.connector.getProtocolHandler().getExecutor();
        if (executor instanceof ThreadPoolExecutor) {
            try {
                ThreadPoolExecutor threadPoolExecutor = (ThreadPoolExecutor) executor;
                log.debug("GracefulShutdown: shutting down thread pool.");
                threadPoolExecutor.shutdown();
                if (!threadPoolExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
                    log.warn("Tomcat thread pool did not shut down gracefully within "
                            + "30 seconds. Proceeding with forceful shutdown");
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
        }
    }
*/
}