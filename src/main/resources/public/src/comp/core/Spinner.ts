import { Comp } from "../base/Comp";

export class Spinner extends Comp {

    constructor(extraClasses: string = "") {
        super({
            className: "spinner-border text-success " + extraClasses,
            role: "status"
        });
    }
}
