import { createElement } from "react";
import { AppContext, getAppState, initDispatch } from "../../AppContext";
import { App } from "../App";

export default function AppContainer() {
    initDispatch();
    const app = new App();
    return createElement(AppContext.Provider, { value: getAppState() }, app.create());
}
