import * as I from "../../Interfaces";
import { Validator } from "../../Validator";
import { Comp } from "../base/Comp";
import { Div } from "./Div";
import { Input } from "./Input";

export class DateField extends Comp implements I.ValueIntf {
    input: Input;

    constructor(private valState: Validator) {
        super();
    }

    override focus(): void {
        this.onMount(() => this.input?.focus());
    }

    setValue(value: string): void {
        this.valState.setValue(value);
    }

    getValue(): string {
        return this.valState.getValue();
    }

    override preRender(): boolean | null {
        this.children = [
            new Div(null, {
                className: "dateField"
            }, [
                this.input = new Input({
                    className: "form-control preTextField",
                    type: "date"
                }, this.valState.v)
            ])
        ];
        return true;
    }
}
