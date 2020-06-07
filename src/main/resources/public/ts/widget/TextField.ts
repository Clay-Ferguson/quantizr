import * as I from "../Interfaces";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { Label } from "./Label";
import { Input } from "./Input";
import { Anchor } from "./Anchor";
import { ToggleIcon } from "./ToggleIcon";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TextField extends Div implements I.TextEditorIntf {

    input: Input;
    icon: ToggleIcon;

    constructor(public label: string = null, private defaultVal: string = "", private isPassword: boolean = false,
        private onEnterKey: () => void = null) {
        super(null);
        S.util.mergeProps(this.attribs, {
            "name": this.getId(),
            className: "form-group",
        });

        this.mergeState({ value: defaultVal || "" });
    }

    //Overriding base class so we can focus the correct part of this composite component.
    focus(): void {
        this.whenElm((elm: HTMLSelectElement) => {
            this.input.focus();
        });
    }

    insertTextAtCursor(text: string) {
        //should we implement this ? todo-1
    }

    setWordWrap(wordWrap: boolean): void {
    }

    setMode(mode: string): void {
    }

    setValue(val: string): void {
        if (this.input) {
            this.input.mergeState({ value: val || "" });
        }
        else {
            this.mergeState({ value: val || "" });
        }
    }

    getValue(): string {
        if (this.input) {
            return this.input.getState().value;
        }
        else {
            return this.getState().value;
        }
    }

    preRender(): void {
        this.setChildren([
            this.label ? new Label(this.label, { key: this.getId() + "_label" }) : null,
            new Div(null, {
                className: "input-group",
                //NOTE: Yes we set font on the PARENT and then use 'inherit' to get it
                //to the component, or elase there's a react-rerender flicker.
                style: {fontFamily: "monospace"}
            }, [
                this.input = new Input({
                    className: "form-control pre-textfield",
                    type: this.isPassword ? "password" : "text",
                    value: this.state.value,
                }),
                this.isPassword ? new Div(null, {
                    className: "input-group-addon",
                }, [
                    new Anchor(null, null, {
                        onClick: (evt) => {
                            evt.preventDefault();
                            this.input._toggleType();
                            this.icon._toggleClass();
                        },
                    }, [
                        this.icon = new ToggleIcon("fa-eye-slash", "fa-eye", {
                            className: "fa fa-lg passwordEyeIcon",
                        })
                    ])
                ]) : null
            ])
        ]);

        if (this.onEnterKey) {
            this.input.attribs.onKeyPress = (e: KeyboardEvent) => {
                if (e.which == 13) { // 13==enter key code
                    this.onEnterKey();
                    return false;
                }
            };
        }
    }
}

