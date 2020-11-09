import * as I from "../Interfaces";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "./base/CompIntf";
import { Button } from "./Button";
import { CompDemoButton } from "./CompDemoButton";
import { Div } from "./Div";
import { Textarea2 } from "./Textarea2";

export class CompDemo extends Div {
    textarea: I.TextEditorIntf;
    textAreaState: ValidatedState<any> = new ValidatedState<any>();

    // Holds the string representation of a datetime
    // dateTimeState: ValidatedState<any> = new ValidatedState<any>();

    constructor() {
        super();
        this.setStateEx({ counter: 0 });
        // this.dateTimeState.setValue("" + new Date().getTime());
    }

    preRender(): void {
        let children: CompIntf[] = [];

        // children.push(new DateTimeField(valueIntf));

        // children.push(this.textarea = new Textarea2("Textarea", { rows: "4" }, this.textAreaState));

        // children.push(new Button("Set Textarea", () => {
        //     this.textarea.setValue("value set!");
        // }));

        // for (let i = 0; i < 10; i++) {
        //     children.push(new CompDemoButton(i));
        // }

        this.setChildren(children);
    }
}
