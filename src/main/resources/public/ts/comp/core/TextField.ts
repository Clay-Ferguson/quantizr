import * as I from "../../Interfaces";
import { ValidatedState } from "../../ValidatedState";
import { Anchor } from "./Anchor";
import { Div } from "./Div";
import { ErrorDiv } from "./ErrorDiv";
import { Input } from "./Input";
import { Label } from "./Label";
import { Span } from "./Span";
import { ToggleIcon } from "./ToggleIcon";

interface LS { // Local State
    inputType?: string;
}

export interface TextFieldConfig {
    label?: string;
    pwd?: boolean;
    enter?: () => void;
    inputClass?: string;
    labelLeft?: boolean;
    val?: ValidatedState<any>;
    outterClass?: string;
    placeholder?: string;
}

export class TextField extends Div implements I.TextEditorIntf, I.ValueIntf {
    input: Input;
    icon: ToggleIcon;

    constructor(public cfg: TextFieldConfig) {
        // do not pass valState into base class, we want it to have state separately
        super(null);

        Object.assign(this.attribs, {
            name: this.getId(),
            className: "textField " + (this.cfg.labelLeft ? "form-inline " : "") + (this.cfg.outterClass || "")
        });

        this.mergeState<LS>({
            inputType: this.cfg.pwd ? "password" : "text"
        });
    }

    setError(error: string): void {
        this.cfg.val.setError(error);
    }

    // Overriding base class so we can focus the correct part of this composite component.
    focus(): void {
        this.whenElm((elm: HTMLElement) => {
            this.input?.focus();
        });
    }

    insertTextAtCursor(text: string) {
    }

    setWordWrap(wordWrap: boolean): void {
    }

    setMode(mode: string): void {
    }

    setValue(value: string): void {
        this.cfg.val.setValue(value);
    }

    getValue(): string {
        return this.cfg.val.getValue();
    }

    preRender(): void {
        let state = this.getState<LS>();

        let label = this.cfg.label ? new Label(this.cfg.label, {
            key: this.getId() + "_label",
            className: "txtFieldLabel",
            htmlFor: "inputId_" + this.getId()
        }) : null;

        let input = this.input = new Input({
            placeholder: this.cfg.placeholder || "",
            className: "form-control pre-textfield " + (this.cfg.inputClass || "") + (this.cfg.val.getError() ? " validationErrorBorder" : ""),
            type: state.inputType,
            id: "inputId_" + this.getId()
        }, this.cfg.val.v);

        let passwordEye = this.cfg.pwd ? new Span(null, {
            className: "input-group-addon"
        }, [
            new Anchor(null, null, {
                onClick: (evt) => {
                    evt.preventDefault();
                    this.mergeState<LS>({
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
                passwordEye
            ]),
            new ErrorDiv(this.cfg.val.e)
        ]);

        if (this.cfg.enter) {
            this.input.attribs.onKeyPress = (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    this.cfg.enter();
                    return false;
                }
            };
        }
    }
}
