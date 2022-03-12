import { ImportTest } from "./ImportTest";
import "bootstrap";
import { Factory } from "./Factory";
import React from "react";
import ReactDOM from "react-dom";
import TsxApp from "./TsxApp";

import "../css/quanta.scss";
import "font-awesome/css/font-awesome.min.css";
import PayPalButton from "./PayPalButton";

// we have this as the first import for troubleshooting how browsers are 
// able to handle the 'import' statement.
ImportTest.check();
console.log("index.tsx finished imports");

// set in index.html
declare var __page;

if ((window as any).__page === "index") {
    console.log("Constructing Factory.");
    let factory = new Factory();
    console.log("Factory complete.");

    window.addEventListener("load", (event) => {
        console.log("factory.initApp");
        factory.initApp();
    });
}
else if ((window as any).__page === "tsx-test") {
    ReactDOM.render(
        <React.StrictMode>
            <TsxApp />
            <PayPalButton />
        </React.StrictMode>,
        document.getElementById("app")
    );
}

function index() {
    return (<div></div>);
}

export default index;
