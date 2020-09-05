import { Constants as C } from "../Constants";
import * as I from "../Interfaces";
import { ValueIntf } from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";
import { Input } from "./Input";
import { Label } from "./Label";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class DateField extends Div implements I.ValueIntf {

    input: Input;

    constructor(public label: string, private valueIntf: ValueIntf) {
        super(null);
        S.util.mergeProps(this.attribs, {
            name: this.getId(),
            className: "form-group",
        });

        this.attribs.onChange = (evt: any) => {
            Comp.renderCachedChildren = true;

            try {
                //console.log("e.target.value=" + evt.target.value);
                this.updateValFunc(evt.target.value);
            }
            finally {
                /* React doesn't have a 'global' way to know when all rendering that's about to be done HAS been done, so all we can do here, is
                use a timeout */
                setTimeout(() => {
                    Comp.renderCachedChildren = false;
                }, 250);
            }
        }
    }

    //Handler to update state
    updateValFunc(value: string): void {
        if (value != this.valueIntf.getValue()) {
            this.valueIntf.setValue(value);
        }
    }

    //Overriding base class so we can focus the correct part of this composite component.
    focus(): void {
        this.whenElm((elm: HTMLSelectElement) => {
            this.input.focus();
        });
    }

    setValue(val: string): void {
        this.valueIntf.setValue(val);
    }

    getValue(): string {
        return this.valueIntf.getValue();
    }

    preRender(): void {
        //console.log("preRender id=" + this.getId() + " value=" + this.valueIntf.getValue());
        let state = this.getState();

        this.setChildren([
            this.label ? new Label(this.label, { key: this.getId() + "_label" }) : null,
            new Div(null, {
                className: "input-group",
                /* NOTE: Yes we set font on the PARENT and then use 'inherit' to get it
                to the component, or elase there's a react-rerender flicker. */
                style: { fontFamily: "monospace" }
            }, [
                this.input = new Input({
                    className: "form-control pre-textfield",
                    type: "date",
                    value: this.valueIntf.getValue()
                }),
            ])
        ]);
    }
}

