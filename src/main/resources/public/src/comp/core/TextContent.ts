import { Comp } from "../base/Comp";

interface LS { // Local State
    text: string;
}

export class TextContent extends Comp {

    constructor(text: string, classes: string = null, public preformatted: boolean = false) {
        super(null);
        this.attribs.className = classes || "alert alert-secondary";
        this.setText(text);
        this.tag = this.preformatted ? "pre" : "div";
    }

    setText = (text: string) => {
        this.mergeState<LS>({ text });
    }

    override preRender = (): boolean => {
        const state = this.getState<LS>();

        // todo-2: Not sure I want to keep detecting HTML this way, because we can just use
        // the HTML class explicity when we need to support HTML
        if (state.text && state.text.indexOf("<") !== -1) {
            this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(state.text);
        }
        else {
            // console.log("Building (TextContent) react element: " + this.attribs.id);
            this.children = [state.text];
        }
        return true;
    }
}
