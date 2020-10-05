import { Div } from "./Div";

export class Header extends Div {

    constructor(public text: string, centered:boolean = false) {
        super(text);
        this.attribs.className = (centered ? "horizontal center-justified layout" : "") + " dialog-header";
    }
}
