import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { Button } from "./Button";
import { Div } from "./Div";

interface LS { // Local State
    content?: string;
}

/*
This is a Simple app that will be running at `http://localhost:8182/demo/tutorial`, which shows a bare minimum
example of using the Quanta React Framework.
*/
export class TutorialApp extends Comp {
    constructor() {
        super();
        this.mergeState<LS>({ content: "Quanta GUI Framework works!" });
    }

    buttonClick = (): void => {
        this.mergeState<LS>({ content: "You clicked a button!" });
    }

    compRender(): ReactNode {
        // NOTE: This is another way to render a raw div, which actually doesn't use the base class, and still works.
        // return (new Div(this.getState<LS>().content, this.attribs)).create();

        return this.tagRender("div", this.getState<LS>().content, null, [
            new Div("Child Div"),
            new Button("My Button", this.buttonClick)
        ]);
    }
}
