import { createElement } from "react";
import { AppContext, getAs, initDispatch } from "../../AppContext";
import { App } from "../App";
import { LayoutDemo } from "../LayoutDemo";

const layoutDemo = false;

/* Builds the application root element wrapping inside AppContext.Provider for our state management */
export default function AppContainer() {
    initDispatch();
    const app = layoutDemo ? new LayoutDemo() : new App();
    return createElement(AppContext.Provider, { value: getAs() }, createElement(app._render, app.attribs));
}
