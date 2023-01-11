import { createElement } from "react";
import { AppContext, getAs, initDispatch } from "../../AppContext";
import { App } from "../App";

export default function AppContainer() {
    initDispatch();
    const app = new App();
    return createElement(AppContext.Provider, { value: getAs() }, app.create());
}
