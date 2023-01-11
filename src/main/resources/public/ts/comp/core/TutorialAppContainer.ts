import { createElement } from "react";
import { AppContext, getAs, initDispatch } from "../../AppContext";
import { TutorialApp } from "./TutorialApp";

export default function TutorialAppContainer() {
    initDispatch();
    const app = new TutorialApp();
    return createElement(AppContext.Provider, { value: getAs() }, app.create());
}
