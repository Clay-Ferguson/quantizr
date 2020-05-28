import * as I from "../Interfaces";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "./Div";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";
import { CompIntf } from "./base/CompIntf";
import { CompDemoButton } from "./CompDemoButton";
import { Textarea } from "./Textarea";
import { Button } from "./Button";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class CompDemo extends Div {
    textarea: I.TextEditorIntf;

    constructor() {
        super();
        this.setStateEx({ counter: 0 });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let cstate = this.getState();
        let children: CompIntf[] = [];

        children.push(this.textarea = new Textarea("Textarea", {
            rows: "4"
        }));

        children.push(new Button("Set Textarea", () => {
            this.textarea.setValue("value set!");
        }));

        for (let i = 0; i < 10; i++) {
            children.push(new CompDemoButton(i));
        }

        this.setChildren(children);
    }
}
