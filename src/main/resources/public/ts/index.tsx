import "bootstrap";
import { Factory } from "./Factory";
import React from "react";
import ReactDOM from "react-dom";
import TsxApp from "./TsxApp";

//set in index.html
declare var __page;

window.onerror = function (message, url, line, col, err) {
    let msg = "ERROR: " + message + " [url:" + url + "] line " + line + " col: " + col;
    if (err.stack) {
        msg += " err: " + err.stack;
    }
    console.log(msg);
};

if (__page === "index") {
    console.log("bundle entrypoint running.");
    const factory = new Factory();
    factory.constructAll();

    factory.singletons.meta64.initApp();
}
else if (__page === "tsx-test") {

    ReactDOM.render(
        <React.StrictMode>
            <TsxApp />
        </React.StrictMode>,
        document.getElementById("app")
    );
}
