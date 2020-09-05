import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as I from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Button } from "./Button";
import { CompDemoButton } from "./CompDemoButton";
import { Div } from "./Div";
import { Textarea } from "./Textarea";

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
        }, {
            getValue: () => {
                return this.getState().textVal;
            },
            setValue: (val: any) => {
                this.mergeState({ textVal: val });
            }
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
