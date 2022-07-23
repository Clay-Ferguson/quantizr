import * as I from "../../Interfaces";
import { S } from "../../Singletons";
import { ValidatedState } from "../../ValidatedState";
import { ErrorDiv } from "./ErrorDiv";
import { Label } from "./Label";
import { Span } from "./Span";
import { TextareaTag } from "./TextareaTag";

interface LS { // Local State
    wordWrap: boolean;
}

export class TextArea extends Span implements I.TextEditorIntf {
    input: TextareaTag;
    textareaAttribs: any = {};

    constructor(private label: string, attribs: any, private valState: ValidatedState<any>, moreClasses: string = "", public calcRows: boolean = false) {
        // do not pass valState into base class, we want it to have state separately
        super(null);

        if (attribs) {
            this.textareaAttribs = { ...this.textareaAttribs, ...attribs };
        }
        this.textareaAttribs = {
            ...this.textareaAttribs, ...{
                className: "form-control pre-textarea " + moreClasses
            }
        };

        if (!this.textareaAttribs.rows) {
            this.textareaAttribs.rows = "1";
        }

        this.setWordWrap(true);
    }

    setError(error: string): void {
        this.valState.setError(error);
    }

    insertTextAtCursor = (text: string) => {
        this.input?.whenElm((elm: any) => {
            if (elm.selectionStart >= 0) {
                this.setValue(S.util.insertString(this.getValue(), text, elm.selectionStart));
            }
        });
    }

    setMode(mode: string): void {
    }

    setValue(val: string): void {
        this.valState.setValue(val);
    }

    getValue(): string {
        return this.valState.getValue();
    }

    setWordWrap(wordWrap: boolean): void {
        this.mergeState<LS>({ wordWrap });
    }

    focus(): void {
        this.whenElm((elm: HTMLElement) => {
            this.input?.focus();
        });
    }

    preRender(): void {
        let state = this.getState<LS>();
        let children = [new ErrorDiv(this.valState.e)];

        if (this.label) {
            children.push(new Label(this.label, {
                htmlFor: this.getId() + "_textarea",
                className: "marginTop"
            }));
        }

        let att = { ...this.textareaAttribs };

        // only if 'id' not already provided we set a default id for textarea,
        // sometimes id is provided in order to help with persistence of focus
        // across react re-renders.
        if (!this.textareaAttribs.id) {
            att.id = this.getId() + "_textarea";
        }

        if (!state.wordWrap) {
            att.style = {
                whiteSpace: "nowrap",
                overflow: "auto"
            };
        }

        if (!att.style) {
            att.style = {};
        }
        att.style.fontFamily = "monospace";

        // Getting a bizarre React error whenver 'onKeyUp' is used.
        //     Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?
        // Not going to take the time to troubleshoot this low-priority need. I was working on making the
        // height of the editors automatically adjust.
        // function calcHeight(value) {
        //     let numberOfLineBreaks = (value.match(/\n/g) || []).length;
        //     // min-height + lines x line-height + padding + border
        //     let newHeight = 20 + numberOfLineBreaks * 20 + 12 + 2;
        //     return newHeight;
        // }
        //  att.onKeyUp = function () {
        //     console.log("keyup.");
        // };
        // let textarea = document.querySelector(".resize-ta");
        // textarea.addEventListener("keyup", () => {
        //     textarea.style.height = calcHeight(textarea.value) + "px";
        // });

        children.push(this.input = new TextareaTag(att, this.valState.v, this.calcRows));
        this.setChildren(children);
    }
}
