import { Comp } from "../base/Comp";

interface LS { // Local State
    toggle?: boolean;
    className?: string;
}

export class ToggleIcon extends Comp {

    constructor(private toggleOnClass: string, private toggleOffClass: string, attribs: any = null) {
        super(attribs);
        this.mergeState<LS>({
            className: this.attribs.className,
            toggle: false
        });
        this.tag = "i";
    }

    toggleClass = () => {
        const state = this.getState<LS>();
        this.mergeState<LS>({ toggle: !state.toggle });
    }

    override preRender = (): boolean => {
        const state = this.getState<LS>();
        this.attribs.className = state.className + " " + (state.toggle ? this.toggleOnClass : this.toggleOffClass);
        return true;
    }
}
