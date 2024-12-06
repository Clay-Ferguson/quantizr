import "../css/quanta.scss"
import React from "react";
import { createRoot } from "react-dom/client";
import { Factory } from "./Factory";
import { ImportTest } from "./ImportTest";
import { S } from "./Singletons";
import AppContainer from "./comp/core/AppContainer";
import { dispatcherReady } from "./AppContext";

// we have this as the first import for troubleshooting how browsers are
// able to handle the 'import' statement.
ImportTest.check();
console.log("main.ts finished imports");
let initialized = false;

const processAppLoad = async () => {
    new Factory();
    S.quanta.config = (window as any).g_config;
    S.aiUtil.init();
    S.quanta.cfg = S.quanta.config.config || {};
    const root = createRoot(document.getElementById("app"));
    root.render(React.createElement(AppContainer));

    // Wait for the dispatcher to be ready before initializing the app, because the dispatcher
    // is needed for all state management
    const dispatchWaiter = setInterval(() => {
        if (dispatcherReady()) {
            clearInterval(dispatchWaiter);
            S.quanta.initApp();
        }
    }, 100);
}

window.addEventListener("load", async (_event) => {
    if (!initialized) {
        initialized = true;
        console.log("Load event.");
        processAppLoad();
    }
    else {
        console.log("Ignoring load event.");
    }
});
