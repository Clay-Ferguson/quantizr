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

    insertTextAtCursor = (text: string) => {
        //should we implement this ? todo-1
    }

    setWordWrap = (wordWrap: boolean): void => {
    }

    setMode = (mode: string): void => {
    }

    /* getters and setters changed to use state. need to test all usages: todo-0 */
    setValue = (val: string): void => {
        if (this.input) {
            //console.log("TextField setVal: [" + this.getId() + "]" + val);
            this.input.mergeState({ value: val || "" });
        }
        else {
            //console.log("TextField setVal: [" + this.getId() + "]" + val);
            this.mergeState({ value: val || "" });
        }
    }

    getValue = (): string => {
        if (this.input) {
            return this.input.getState().value;
        }
        else {
            return this.getState().value;
        }
    }

    preRender = (): void => {
        //console.log("TextField preRender: [" + this.getId() + "]" + this.state.value);
        this.setChildren([
            new Label(this.label, { key: this.getId() + "_label" }),
            new Div(null, {
                className: "input-group",
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
                            this.input.toggleType();
                            this.icon.toggleClass();
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

