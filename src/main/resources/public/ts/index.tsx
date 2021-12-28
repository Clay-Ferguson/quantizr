import "bootstrap";
import { Factory } from "./Factory";
import React from "react";
import ReactDOM from "react-dom";
import TsxApp from "./TsxApp";

import "../css/quanta.scss";
import "font-awesome/css/font-awesome.min.css";
import PayPalButton from "./PayPalButton";

// set in index.html
declare var __page;

if ((window as any).__page === "index") {
    let factory = new Factory();
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
