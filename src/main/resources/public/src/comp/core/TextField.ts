import * as I from "../../Interfaces";
import { Tailwind } from "../../Tailwind";
import { Validator } from "../../Validator";
import { Anchor } from "./Anchor";
import { Div } from "./Div";
import { ErrorDiv } from "./ErrorDiv";
import { Input } from "./Input";
import { Label } from "./Label";
import { Span } from "./Span";
import { Tag } from "./Tag";
import { ToggleIcon } from "./ToggleIcon";

interface LS { // Local State
    inputType?: string;
}

export interface TextFieldConfig {
    label?: string;
    enter?: () => void;
    inputClass?: string;
    labelClass?: string;
    val?: Validator;
    outterClass?: string;
    placeholder?: string;
    outterTagName?: string; // normally div or span
    inputType?: string;
}

export class TextField extends Tag implements I.TextEditorIntf, I.ValueIntf {
    input: Input;
    icon: ToggleIcon;

    constructor(public cfg: TextFieldConfig) {
        // do not pass valState into base class, we want it to have state separately
        super(cfg.outterTagName || "div");

        this.attribs.name = this.getId();
        if (this.cfg.outterClass) {
            this.attribs.className = this.cfg.outterClass;
        }

        this.mergeState<LS>({
            inputType: this.cfg.inputType || "text"
        });
    }

    setError(error: string): void {
        this.cfg.val.setError(error);
    }

    // Overriding base class so we can focus the correct part of this composite component.
    override focus(): void {
        this.onMount(() => this.input?.focus());
    }

    getSelStart = (): number => {
        return this.input.getRef() ? (this.input.getRef() as any).selectionStart : -1;
    }

    insertTextAtCursor(_text: string) {
    }

    setWordWrap(_wordWrap: boolean): void {
    }

    setEnabled(_enabled: boolean): void {
    }

    setMode(_mode: string): void {
    }

    setValue(value: string): void {
        this.cfg.val.setValue(value);
    }

    getValue(): string {
        return this.cfg.val.getValue();
    }

    override preRender(): boolean | null {
        const state = this.getState<LS>();

        const label = this.cfg.label ? new Label(this.cfg.label, {
            key: "label_" + this.getId(),
            className: this.cfg.labelClass || "txtFieldLabel",
            htmlFor: "inputId_" + this.getId()
        }) : null;

        this.input = new Input({
            placeholder: this.cfg.placeholder || "",
            className: Tailwind.formControl + " preTextField " + (this.cfg.inputClass || "") + (this.cfg.val.getError() ? " validationErrorBorder" : ""),
            type: state.inputType,
            id: "inputId_" + this.getId()
        }, this.cfg.val.v);

        const inputGroupAddon = "inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 border border-l-0 border-gray-300 rounded-r hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        const passwordEye = this.cfg.inputType === "password" ? new Span(null, {
            className: inputGroupAddon
        }, [
            new Anchor(null, null, {
                onClick: (evt: Event) => {
                    evt.preventDefault();
                    this.mergeState<LS>({
                        inputType: state.inputType === "password" ? "text" : "password"
                    });
                    this.icon.toggleClass();
                }
            }, [
                this.icon = new ToggleIcon("fa-eye-slash", "fa-eye", {
                    className: "fa fa-lg passwordEyeIcon"
                })
            ])
        ]) : null;

        this.children = [
            label,
            new Div(null, {
                className: "flex textField"
            }, [
                this.input,
                passwordEye
            ]),
            new ErrorDiv(this.cfg.val.e)
        ];

        if (this.cfg.enter) {
            this.input.attribs.onKeyPress = (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    this.cfg.enter();
                    return false;
                }
            };
        }
        return true;
    }
}
