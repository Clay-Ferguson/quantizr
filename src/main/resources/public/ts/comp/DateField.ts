import { Constants as C } from "../Constants";
import * as I from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { Div } from "./Div";
import { Input } from "./Input";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class DateField extends Div implements I.ValueIntf {
    input: Input;

    constructor(private valState: ValidatedState<any>) {
        super(null);
    }

    focus(): void {
        this.whenElm((elm: HTMLElement) => {
            this.input.focus();
        });
    }

    setValue(value: string): void {
        this.valState.setValue(value);
    }

    getValue(): string {
        return this.valState.getValue();
    }

    preRender(): void {
        this.setChildren([
            new Div(null, {
                /* NOTE: Yes we set font on the PARENT and then use 'inherit' to get it
                to the component, or elase there's a react-rerender flicker. */
                style: { fontFamily: "monospace" }
            }, [
                this.input = new Input({
                    className: "form-control pre-textfield",
                    type: "date"
                }, this.valState.v)
            ])
        ]);
    }
}
