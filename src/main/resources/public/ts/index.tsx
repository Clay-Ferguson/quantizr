import "bootstrap";
import React from "react";
import ReactDOM from "react-dom";
import { Factory } from "./Factory";
import { ImportTest } from "./ImportTest";
import TsxApp from "./TsxApp";
import "font-awesome/css/font-awesome.min.css";
import "../css/quanta.scss";
import TutorialAppContainer from "./comp/core/TutorialAppContainer";
import AppContainer from "./comp/core/AppContainer";

// we have this as the first import for troubleshooting how browsers are
// able to handle the 'import' statement.
ImportTest.check();
console.log("index.tsx finished imports");

// This is how we run the main app (normal flow)
if ((window as any).__page === "index") {
    window.addEventListener("load", (event) => {
        const factory = new Factory();
        if (factory) {
            ReactDOM.render(<AppContainer />, document.getElementById("app"));
            factory.initApp();
        }
    });
}
// This is how we can provide the page at `http://localhost:8182/demo/tsx-test` which is used
// for running simple tests for react TSX components, to troubleshoot and make sure TXS is working, or
// experiment with snippets of rendered content, etc.
else if ((window as any).__page === "tsx-test") {
    // todo-1: research StrictMode.
    ReactDOM.render(
        <React.StrictMode>
            <TsxApp />
        </React.StrictMode>,
        document.getElementById("app")
    );
}
else if ((window as any).__page === "tutorial") {
    window.addEventListener("load", (event) => {
        const factory = new Factory();
        if (factory) {
            ReactDOM.render(<TutorialAppContainer />, document.getElementById("app"));
        }
    });
}

function index() {
    return (<div></div>);
}

export default index;
