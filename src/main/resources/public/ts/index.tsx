import "bootstrap";
import { Factory } from "./Factory";
import React from "react";
import ReactDOM from "react-dom";
import TsxApp from "./TsxApp";

// SCSS not ready yet in webpack.
// import "../css/quanta.scss";

// set in index.html
declare var __page;

if ((window as any).__page === "index" || //
    (window as any).__page === "welcome") {
    let factory = new Factory();
}
else if ((window as any).__page === "tsx-test") {
    ReactDOM.render(
        <React.StrictMode>
            <TsxApp />
        </React.StrictMode>,
        document.getElementById("app")
    );
}

function index() {
    return (<div></div>);
}

export default index;
