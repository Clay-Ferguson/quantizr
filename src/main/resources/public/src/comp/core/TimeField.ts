import * as I from "../../Interfaces";
import { Tailwind } from "../../Tailwind";
import { ValHolder } from "../../ValHolder";
import { Comp } from "../base/Comp";
import { Div } from "./Div";
import { Input } from "./Input";

export class TimeField extends Comp implements I.ValueIntf {
    input: Input;

    constructor(private valState: ValHolder, private extraClass: string = null) {
        super();
    }

    // Overriding base class so we can focus the correct part of this composite component.
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
                className: this.extraClass + " timeField"
            }, [
                this.input = new Input({
                    className: Tailwind.formControl + " preTextField",
                    type: "time"
                }, this.valState.v)
            ])
        ];
        return true;
    }
}
