import * as I from "../Interfaces";
import { Comp } from "./base/Comp";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TextField extends Comp implements I.TextEditorIntf {

    constructor(public label: string = null, attribs: any = null, private prefillVal: string = null, private isPassword: boolean = false) {
        super(attribs);
        S.util.mergeProps(this.attribs, {
            "name": this.getId(),
            className: "form-control pre-textfield textfield"
        });

        if (prefillVal) {
            this.whenElm((elm: HTMLInputElement) => {
                elm.value = prefillVal;
            });
        }
    }

    setFieldType = (fieldType: string) => {
        this.mergeState({
            fieldType
        });
    }

    insertTextAtCursor = (text: string) => {
        //should we implement this ? todo-1
    }

    setWordWrap = (wordWrap: boolean): void => {
    }

    setMode = (mode: string): void => {
    }

    setValue = (val: string): void => {
        S.util.setInputVal(this.getId(), val || "");
    }

    getValue = (): string => {
        let elm = this.getElement();
        if (elm) {
            return (<any>elm).value.trim();
        }
        return null;
    }

    compRender = (): ReactNode => {
        let children = [];

        if (this.label) {
            children.push(S.e('label', {
                id: this.getId() + "_label",
                key: this.getId() + "_label",
                className: 'textfield-label', 
                htmlFor: this.getId()
            }, this.label));
        }

        let type = this.getState().fieldType ? this.getState().fieldType :  (this.isPassword ? "password" : "text");
        this.attribs.type = type;

        children.push(S.e('input', this.attribs));

        if (this.isPassword) {

            let icon = S.e('i', {
                key: "s_" + this.getId(),
                className: "fa fa-eye",
                style: {
                    marginRight: "6px"
                }
            });

            let button = S.e('button', {
                id: this.getId() + "_btn",
                key: this.getId() + "_btn",
                className: "btn btn-secondary",
                onClick: () => {
                    this.setFieldType(this.attribs.type == "text" ? "password" : "text");
                }
            }, [icon, "Show"]);

            children.push(button);
        }

        return S.e('div', {
            id: this.getId() + "_text",
            key: this.getId() + "_text",
            className: "horizontalLayout",
            style: {
                display: this.getState().visible ? "block" : "none"
            }
        }, children);
    }
}
