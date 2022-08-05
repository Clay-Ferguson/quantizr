import * as I from "../../Interfaces";
import { ValidatedState } from "../../ValidatedState";
import { Div } from "./Div";
import { Input } from "./Input";

export class DateField extends Div implements I.ValueIntf {
    input: Input;

    constructor(private valState: ValidatedState<any>) {
        super(null);
    }

    focus(): void {
        this.onMount(() => this.input?.focus());
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
                className: "dateField"
            }, [
                this.input = new Input({
                    className: "form-control pre-textfield",
                    type: "date"
                }, this.valState.v)
            ])
        ]);
    }
}
