import { ReactNode } from "react";
import { State } from "../../State";
import { Comp, ScrollPos } from "../base/Comp";

interface LS { // Local State
    value: string;
}

export class TextareaTag extends Comp {
    static CHAR_THRESHOLD = 40;
    static MIN_ROWS = 3;
    static MAX_ROWS = 15;

    constructor(attribs: Object = {}, s?: State, private calcRows: boolean = false, private scrollPos: ScrollPos = null) {
        super(attribs, s);
        this.attribs.onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
            this.mergeState<LS>({ value: evt.target.value });
        };
    }

    splitLines = (str: string): string[] => {
        // todo-0: in the TTS engine we have something like this done differently. Research which is best
        return str.split(/\r?\n/);
    }

    calcRowsFunc(val: string): number {
        let rows = TextareaTag.MIN_ROWS;
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

        if (rows < TextareaTag.MIN_ROWS) {
            rows = TextareaTag.MIN_ROWS;
        }
        else if (rows > TextareaTag.MAX_ROWS) {
            rows = TextareaTag.MAX_ROWS;
        }

        return rows;
    }

    getScrollPos = (): number => {
        return this.scrollPos ? this.scrollPos.getVal() : null;
    }

    setScrollPos = (pos: number): void => {
        this.scrollPos?.setVal(pos);
    }

    compRender = (): ReactNode => {
        this.attribs.value = this.getState<LS>().value;
        if (this.calcRows) {
            this.attribs.rows = "" + this.calcRowsFunc(this.attribs.value);
        }
        return this.tag("textarea");
    }
}
