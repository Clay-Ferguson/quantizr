import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import * as I from "../Interfaces";
import { ValueIntf } from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "./Anchor";
import { Comp } from "./base/Comp";
import { Div } from "./Div";
import { Input } from "./Input";
import { Label } from "./Label";
import { Span } from "./Span";
import { ToggleIcon } from "./ToggleIcon";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TextField extends Div implements I.TextEditorIntf, I.ValueIntf {
    input: Input;
    icon: ToggleIcon;

    constructor(public label: string, private isPassword: boolean, private onEnterKey: () => void, private inputClasses: string, labelOnLeft: boolean, public valueIntf: ValueIntf) {
        super(null);

        /* Manage state internally if no valueIntf passed in */
        if (!valueIntf) {
            this.valueIntf = new CompValueHolder<string>(this, "val");
        }

        S.util.mergeProps(this.attribs, {
            name: this.getId(),
            className: "form-group" + (labelOnLeft ? " form-inline" : "")
        });

        this.mergeState({
            inputType: isPassword ? "password" : "text"
        });

        this.attribs.onChange = (evt: any) => {
            Comp.renderCachedChildren = true;

            try {
                // console.log("e.target.value=" + evt.target.value);
                this.updateValFunc(evt.target.value);
            }
            finally {
                /* React doesn't have a 'global' way to know when all rendering that's about to be done HAS been done, so all we can do here, is
                use a timeout */
                setTimeout(() => {
                    Comp.renderCachedChildren = false;
                }, 250);
            }
        };
    }

    setError(error: string): void {
        this.mergeState({ error });
    }

    // Handler to update state
    updateValFunc(value: string): void {
        if (value !== this.valueIntf.getValue()) {
            this.valueIntf.setValue(value);
        }
    }

    // Overriding base class so we can focus the correct part of this composite component.
    focus(): void {
        this.whenElm((elm: HTMLSelectElement) => {
            this.input.focus();
        });
    }

    insertTextAtCursor(text: string) {
        // should we implement this ? todo-1
    }

    setWordWrap(wordWrap: boolean): void {
    }

    setMode(mode: string): void {
    }

    setValue(val: string): void {
        this.valueIntf.setValue(val);
    }

    getValue(): string {
        return this.valueIntf.getValue();
    }

    preRender(): void {
        let state = this.getState();

        let validationError = this.valueIntf.getValidationError ? this.valueIntf.getValidationError() : null;

        let label = this.label ? new Label(this.label, {
            key: this.getId() + "_label",
            className: "txtFieldLabel",
            htmlFor: "inputId_" + this.getId()
        }) : null;

        let input = this.input = new Input({
            className: "form-control pre-textfield " + (this.inputClasses || "") + (validationError ? " validationErrorBorder" : ""),
            type: state.inputType,
            value: this.valueIntf.getValue(),
            id: "inputId_" + this.getId()
        });

        let passwordEye = this.isPassword ? new Span(null, {
            className: "input-group-addon"
        }, [
            new Anchor(null, null, {
                onClick: (evt) => {
                    evt.preventDefault();
                    this.mergeState({
                        inputType: state.inputType === "password" ? "text" : "password"
                    });
                    this.icon._toggleClass();
                }
            }, [
                this.icon = new ToggleIcon("fa-eye-slash", "fa-eye", {
                    className: "fa fa-lg passwordEyeIcon"
                })
            ])
        ]) : null;

        let error = validationError ? new Div(validationError, {
            key: this.getId() + "_labelErr",
            className: "validationError"
        }) : null;

        this.setChildren([
            // NOTE: keep label outside of input-group
            label,

            new Div(null, {
                className: "input-group",
                // **** IMPORTANT ****: Yes we set font on the PARENT and then use 'inherit' to get it
                // to the component, or else there's a react-rerender flicker.
                style: { fontFamily: "monospace" }
            }, [
                input,
                passwordEye,
                error
            ])
        ]);

        if (this.onEnterKey) {
            this.input.attribs.onKeyPress = (e: KeyboardEvent) => {
                if (e.which === 13) { // 13==enter key code
                    this.onEnterKey();
                    return false;
                }
            };
        }
    }
}
