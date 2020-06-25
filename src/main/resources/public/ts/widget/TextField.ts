import * as I from "../Interfaces";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { Label } from "./Label";
import { Input } from "./Input";
import { Anchor } from "./Anchor";
import { ToggleIcon } from "./ToggleIcon";
import { ValueIntf } from "../Interfaces";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TextField extends Div implements I.TextEditorIntf, I.ValueIntf {

    input: Input;
    icon: ToggleIcon;

    constructor(public label: string = null, private defaultVal: string = "", private isPassword: boolean = false,
        private onEnterKey: () => void = null, private valueIntf: ValueIntf = null) {
        super(null);
        S.util.mergeProps(this.attribs, {
            "name": this.getId(),
            className: "form-group",
        });

        /* If we weren't passed a delegated value interface, then construct one. */
        if (!this.valueIntf) {
            this.valueIntf = {
                setValue: (val: string): void => {
                    this.mergeState({ value: val || "" });
                },

                getValue: (): string => {
                    return this.getState().value;
                }
            }

            //WARNING: It's ok to call setValue inside the constructor when we created out own valueIntf object, because we know
            //it cannot go into infinite recursion, but if valueIntf was passed in, it would be dangerous, and also wouldn't make any sense
            //because we'd expect the passed valueIntf to be in control and no defaultVal param would need to be passed in
            //
            //NOTE: "!=null" is important here, don't switch to !!defaultVal or even just 'defaultVal'. We mean litterally 
            //every value other than null here. is this identical thing needed in "Textarea" also ? 
            if (defaultVal != null) {
                this.valueIntf.setValue(defaultVal);
            }
        }

        // todo-1: need this on ACE editor and also TextField (same with updateValFunc)
        this.attribs.onChange = (evt: any) => {
            Comp.renderCachedChildren = true;

            try {
                //todo-0: it will be critical to have a finally block here.
                //console.log("e.target.value=" + evt.target.value);
                this.updateValFunc(evt.target.value);
            }
            finally {
                setTimeout(() => {
                    Comp.renderCachedChildren = false;
                }, 250);
            }
        }
    }

    //Handler to update state if edit field looses focus
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

    insertTextAtCursor(text: string) {
        //should we implement this ? todo-1
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
        //console.log("preRender id=" + this.getId() + " value=" + this.valueIntf.getValue());

        this.setChildren([
            this.label ? new Label(this.label, { key: this.getId() + "_label" }) : null,
            new Div(null, {
                className: "input-group",
                //NOTE: Yes we set font on the PARENT and then use 'inherit' to get it
                //to the component, or elase there's a react-rerender flicker.
                style: { fontFamily: "monospace" }
            }, [
                this.input = new Input({
                    className: "form-control pre-textfield",
                    type: this.isPassword ? "password" : "text",
                    value: this.valueIntf.getValue()
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

