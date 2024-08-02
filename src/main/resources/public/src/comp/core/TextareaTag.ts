import { Validator } from "../../Validator";
import { Comp, ScrollPos } from "../base/Comp";

interface LS { // Local State
    value: string;
}

export class TextareaTag extends Comp {
    static CHAR_THRESHOLD = 40;
    static MAX_ROWS = 15;

    constructor(attribs: any = null, private valState: Validator, private dynamicRows: boolean = false, private minRows: number, private scrollPos: ScrollPos = null) {
        super(attribs, valState.v);
        this.attribs.onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
            this.mergeState<LS>({ value: evt.target.value });
        };
        this.tag = "textarea";
    }

    splitLines = (str: string): string[] => {
        // todo-2: in the TTS engine we have something like this done differently. Research which is best
        return str.split(/\r?\n/);
    }

    /* todo-2: at some point in 2024 probably the 'field-sizing' attribute of textarea elements css may be supported
    by enough browsers to rely on instead of this caluclation approach we have here */
    calcRows(val: string): number {
        let rows = this.minRows;
        if (val) {
            const arr = this.splitLines(val);
            if (arr) {
                rows = arr.length;

                // for each line over threshold characters we add a new line such that every 100 characters
                // causes a newline.
                arr.forEach(line => {
                    if (line.length > TextareaTag.CHAR_THRESHOLD) {
                        rows += Math.round(line.length / TextareaTag.CHAR_THRESHOLD);
                    }
                });
            }
            else {
                if (val.length > TextareaTag.CHAR_THRESHOLD) {
                    rows += Math.round(val.length / TextareaTag.CHAR_THRESHOLD);
                }
            }
        }

        if (rows < this.minRows) {
            rows = this.minRows;
        }
        else if (rows > TextareaTag.MAX_ROWS) {
            rows = TextareaTag.MAX_ROWS;
        }

        return rows;
    }

    override getScrollPos = (): number => {
        return this.scrollPos ? this.scrollPos.getVal() : null;
    }

    override setScrollPos = (pos: number): void => {
        this.scrollPos?.setVal(pos);
    }

    override preRender = (): boolean => {
        this.attribs.value = this.getState<LS>().value;
        if (this.dynamicRows) {
            this.attribs.rows = "" + this.calcRows(this.attribs.value);
        }

        this.attribs.onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const textarea: any = this.getRef();
                if (textarea) {
                    textarea.setRangeText("    ", textarea.selectionStart, textarea.selectionStart, "end");
                    this.valState.setValue(textarea.value);
                }
            }
        };

        return true;
    }
}
