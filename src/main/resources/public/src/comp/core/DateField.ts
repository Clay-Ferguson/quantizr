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
        const formControl = "tw-flex-1 tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-l focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-blue-500"
        this.children = [
            new Div(null, {
                className: "dateField"
            }, [
                this.input = new Input({
                    className: `${formControl} preTextField`,
                    type: "date"
                }, this.valState.v)
            ])
        ];
        return true;
    }
}
