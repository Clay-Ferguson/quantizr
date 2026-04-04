import { createElement } from "react";
import { AppContext, getAs, initDispatch } from "../../AppContext";
import { App } from "../App";
import { LayoutDemo } from "../LayoutDemo";

const layoutDemo = false;

/* Builds the application root element wrapping inside AppContext for our state management */
export default function AppContainer() {
    initDispatch();
    const app = layoutDemo ? new LayoutDemo() : new App();
    // Historical note: This `AppContext` used to be `AppContext.Provider` but as of React 19, we no longer need Provider.
    return createElement(AppContext, { value: getAs() }, createElement(app._render, app.attribs));
}
