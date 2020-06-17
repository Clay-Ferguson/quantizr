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

    //the defaltVal here will be overridden by valueIntf return value if valueIntf is provided.
    //and ditto for Textarea right ? todo-0
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
                    this.mergeState({ value: val || "" }, true);
                },

                getValue: (): string => {
                    return this.getState().value;
                }
            }
        }

        //NOTE: "!=null" is important here, don't switch to !!defaultVal or even just 'defaultVal'. We mean litterally 
        //every value other than null here. is this identical thing needed in "Textarea" also ? todo-0
        if (defaultVal != null) {
            this.valueIntf.setValue(defaultVal);
        }

        // todo-1: need this on ACE editor and also TextField (same with updateValFunc)
        this.attribs.onChange = (evt: any) => {
            Comp.renderCachedChildren = true; //need same code on Textarea (todo-0)

            //todo-0: it will be critical to have a finally block here.
            //console.log("e.target.value=" + evt.target.value);
            this.updateValFunc(evt.target.value);

            setTimeout(() => {
                Comp.renderCachedChildren = false;
            }, 250);
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

