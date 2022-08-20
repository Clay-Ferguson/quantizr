import { createElement } from "react";
import { AppContext, getAppState, initDispatch } from "../../AppContext";
import { TutorialApp } from "./TutorialApp";

export default function TutorialAppContainer() {
    initDispatch();
    const app = new TutorialApp();
    return createElement(AppContext.Provider, { value: getAppState() }, app.create());
}
