import { Factory } from "./Factory";

import 'bootstrap';

//set in index.html
declare var browserSupported;

window.onerror = function (message, url, line, col, err) {
	var msg = "ERROR: " + message + " [url:" + url + "] line " + line + " col: " + col;
	if (err.stack) {
		msg += " err: " + err.stack;
	}
	console.log(msg);
}

if (browserSupported) {
	console.log("bundle entrypoint running.");
	let factory = new Factory();
	factory.constructAll();

	factory.singletons.meta64.initApp();
}
