import * as I from "../../Interfaces";
import { ValHolder } from "../../ValHolder";
import { Comp } from "../base/Comp";
import { Div } from "./Div";
import { Input } from "./Input";

export class DateField extends Comp implements I.ValueIntf {
    input: Input;

    constructor(private valState: ValHolder) {
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
        const formControl = "flex-1 px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
