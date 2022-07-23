import * as I from "../../Interfaces";
import { ValidatedState } from "../../ValidatedState";
import { Div } from "./Div";
import { Input } from "./Input";

export class TimeField extends Div implements I.ValueIntf {

    input: Input;

    constructor(private valState: ValidatedState<any>, private extraClass: string = null) {
        super(null);
    }

    // Overriding base class so we can focus the correct part of this composite component.
    focus(): void {
        this.onMount((elm: HTMLElement) => {
            this.input?.focus();
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
                style: { fontFamily: "monospace" },
                className: this.extraClass
            }, [
                this.input = new Input({
                    className: "form-control pre-textfield",
                    type: "time"
                }, this.valState.v)
            ])
        ]);
    }
}
