import "bootstrap";
import "font-awesome/css/font-awesome.min.css";
import React from "react";
import { createRoot } from "react-dom/client";
import "../css/quanta.scss";
import AppContainer from "./comp/core/AppContainer";
import { Factory } from "./Factory";
import { ImportTest } from "./ImportTest";
import { S } from "./Singletons";

// we have this as the first import for troubleshooting how browsers are
// able to handle the 'import' statement.
ImportTest.check();
console.log("index.ts finished imports");
const root = createRoot(document.getElementById("app"));

// This is how we run the main app (normal flow)
window.addEventListener("load", async (event) => {
    const factory = new Factory();
    await S.quanta.loadConfig();

    // NOTE: We can use JSX like this if we want...
    // root.render(<AppContainer />);
    // But most of this app uses createElement, so we do that here, but it's a trivial choice
    // TsxApp and TutorialAppContainer (in addition to AppContainer) should also be able to work here.
    root.render(React.createElement(AppContainer));
    factory.initApp();
});
