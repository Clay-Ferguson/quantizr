package org.subnode.config;

//This class is commented out because the application.property as follows appears to be enough, to make video streaming not timeout after a minute or so, which is
//all I wa stying to accomplish, so the code posted here
//https://stackoverflow.com/questions/42877498/async-timeout-downloading-a-large-file-using-streamingresponsebody-on-spring-boo
//is not needed but only this property is required (at least for spring-boot):
//spring.mvc.async.request-timeout = 3600000

// @Configuration
// @EnableAsync
// @EnableScheduling
public class AsyncConfiguration {
// implements AsyncConfigurer {

//     private final Logger log = LoggerFactory.getLogger(AsyncConfiguration.class);

//     @Override
//     @Bean(name = "taskExecutor")
//     public AsyncTaskExecutor getAsyncExecutor() {
//         log.debug("Creating Async Task Executor");
//         ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
//         executor.setCorePoolSize(...);
//         executor.setMaxPoolSize(...);
//         executor.setQueueCapacity(...);
//         executor.setThreadNamePrefix(...);
//         return executor;
//     }

//     @Override
//     public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
//         return new SimpleAsyncUncaughtExceptionHandler();
//     }

//     /** Configure async support for Spring MVC. */
//     @Bean
//     public WebMvcConfigurerAdapter webMvcConfigurerAdapter(AsyncTaskExecutor taskExecutor, CallableProcessingInterceptor callableProcessingInterceptor) {
//         return new WebMvcConfigurerAdapter() {
//             @Override
//             public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
//                 configurer.setDefaultTimeout(...)
//                     .setTaskExecutor(taskExecutor);
//                 configurer.registerCallableInterceptors(callableProcessingInterceptor);
//                 super.configureAsyncSupport(configurer);
//             }
//         };
//     }

//     @Bean
//     public CallableProcessingInterceptor callableProcessingInterceptor() {
//         return new TimeoutCallableProcessingInterceptor() {
//             @Override
//             public <T> Object handleTimeout(NativeWebRequest request, Callable<T> task) throws Exception {
//                 log.error("timeout!");
//                 return super.handleTimeout(request, task);
//             }
//         };
//     }
}