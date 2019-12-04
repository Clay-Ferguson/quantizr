# Quantizr Server Push

Quantizr uses SpringBoot SseEmitter and JavaScript EventSource to accomplish server push from browser to server.

The implementation doesn't support IE11, but does support modern browsers. There are shims available to make EventSouce work in IE11, but none of that is included in Quantizr. Quantizr app expects a modern browser.

The APIs are so simple I decided to write this note file and explain so here it is:

# Client Side Code

```ts
    const eventSource = new EventSource(S.util.getRpcPath() + "serverPush");

    eventSource.onmessage = e => {
        //const msg = JSON.parse(e.data);
        console.log("ServerPush Recieved: " + e.data);
    };

    eventSource.onopen = (e: any) => {
        console.log("ServerPush.onopen" + e);
    }

    eventSource.onerror = (e: any) => {
        console.log("ServerPush.onerror:" + e);
    };

    eventSource.addEventListener('serverPushEvent', function (e: any) {
        console.log("ServerPushEvent:", e.data);
    }, false);
```

# Server Side Code

API_PATH is not defined here nor is the enclosing class for this method but suffice it to say that this is a normal Spring REST controller class.

```java
	@GetMapping(API_PATH + "/serverPush")
	public SseEmitter serverPush() {
		SseEmitter emitter = new SseEmitter();
		ExecutorService sseMvcExecutor = Executors.newSingleThreadExecutor();
		sseMvcExecutor.execute(() -> {
			try {
				for (int i = 0; true; i++) {
					SseEventBuilder event = SseEmitter.event() //
							.data("SSE Event - " + LocalTime.now().toString()) //
							.id(String.valueOf(i)) //
							.name("serverPushEvent");
					emitter.send(event);
					Thread.sleep(3000);
				}
			} catch (Exception ex) {
				emitter.completeWithError(ex);
			}
		});
		return emitter;
	}
```

# References

https://www.baeldung.com/spring-server-sent-events