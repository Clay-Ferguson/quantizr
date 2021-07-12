import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { State } from "../State";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TextareaTag extends Comp {
    static CHAR_THRESHOLD = 40;
    static MIN_ROWS = 3;
    static MAX_ROWS = 15;

    constructor(attribs: Object = {}, s?: State<any>, private calcRows: boolean = false) {
        super(attribs, s);
        this.attribs.onChange = (evt) => {
            this.mergeState({ value: evt.target.value });
        };
    }

    splitLines = (str: string): string[] => {
        return str.split(/\r?\n/);
    }

    calcRowsFunc(val: string): number {
        let rows = TextareaTag.MIN_ROWS;
        if (val) {
            let arr = this.splitLines(val);
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

    compRender(): ReactNode {
        this.attribs.value = this.getState().value;
        if (this.calcRows) {
            this.attribs.rows = "" + this.calcRowsFunc(this.attribs.value);
        }
        return this.e("textarea", this.attribs);
    }
}
