import { Constants as C } from "../Constants";
import * as I from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { ErrorDiv } from "./ErrorDiv";
import { Label } from "./Label";
import { Span } from "./Span";
import { TextareaTag } from "./TextareaTag";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Textarea2 extends Span implements I.TextEditorIntf {

    input: TextareaTag;
    textareaAttribs: any = {};

    constructor(private label: string, attribs: any, private valState: ValidatedState<any>, customClass: string = null) {
        // do not pass valState into base class, we want it to have state separately
        super(null);
        this.attribs.style = { fontFamily: "monospace" };

        S.util.mergeProps(this.textareaAttribs, attribs);
        S.util.mergeProps(this.textareaAttribs, {
            className: customClass || "form-control pre-textarea"
        });

        if (!this.textareaAttribs.rows) {
            this.textareaAttribs.rows = "1";
        }

        this.setWordWrap(true);
    }

    setError(error: string): void {
        this.valState.setError(error);
    }

    insertTextAtCursor = (text: string) => {
        // should we implement this ? todo-1
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
        this.valState.v.mergeState({ wordWrap });
    }

    focus(): void {
        this.whenElm((elm: HTMLSelectElement) => {
            if (this.input) {
                this.input.focus();
            }
        });
    }

    preRender(): void {
        let state = this.getState();
        let children = [];

        children.push(new ErrorDiv(this.valState.e)); // className: "alert alert-warning"

        if (this.label) {
            children.push(new Label(this.label, {
                htmlFor: this.getId() + "_textarea"
            }));
        }

        let _attribs = { ...this.textareaAttribs };
        _attribs.id = this.getId() + "_textarea";
        if (!state.wordWrap) {
            _attribs.style = {
                whiteSpace: "nowrap",
                overflow: "auto"
            };
        }

        if (!_attribs.style) {
            _attribs.style = {};
        }
        _attribs.style.fontFamily = "monospace";

        children.push(this.input = new TextareaTag(_attribs, this.valState.v));
        this.setChildren(children);
    }
}
