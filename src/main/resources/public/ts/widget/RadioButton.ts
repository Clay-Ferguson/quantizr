import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* I never got state management working with this radio button properly. 

UPDATE: I did change the the 'attribs.checked' to 'attribs.defaultChecked' and I think that may
have fixed the issues I was having so that if i try again to get the state (this.state) stuff working
it might finally work now.
*/
export class RadioButton extends Comp {

    constructor(public label: string, public checked: boolean, groupName: string, _attribs: any=null) {
        super(_attribs); 

        //todo-1: for RadioButton and CheckBox we are not handling change
        //internally, but externally. Is this good?
        // this.attribs.onChange = () => {
        //     // if (!this.state.checked) {
        //     //     delete this.state.checked;
        //     // }
        //     // else {
        //     //     this.state.checked = "checked";
        //     // }
        //     // this.state = {checked: this.state.checked};
        //     // this.setState(this.state);
        //     //console.log("Change detected [id="+this.getId()+"]: checked="+this.state.checked);
        // };

        // this.attribs.onClick = () => {
        //     //this.state = {checked: this.state.checked};
        //     this.setState(this.state);
        //     console.log("click detected [id="+this.getId()+"]: checked="+this.state.checked);
        // };
    
        if (checked) {
            this.attribs.defaultChecked = "checked";
        }
        this.attribs.name = groupName; 
        this.attribs.type = "radio";
        this.attribs.label = label;
        this.attribs.value = "val-"+this.getId();
    }

    // setChecked(checked: boolean) {
    //     console.log("setChecked()="+checked);
    //     // this.whenElm((elm: HTMLElement) => {
    //     //     (<any>elm).checked = checked;
    //     // });
    //     this.state = {checked};
    //     this.setState(this.state);
    // }

    getChecked(): boolean {
        //console.log("getChecked()="+this.state.checked);
        let elm: HTMLElement = S.util.domElm(this.getId());
        return elm && (<any>elm).checked;
        //return this.state.checked;
    }

    compRender = (): ReactNode => {
        // this.initState({
        //     checked: p.checked
        // });

        if (this.label) {
            return S.e('span', { key: this.attribs.id + "_span" }, 
            S.e('input', this.attribs), S.e('label', { key: this.attribs.id + "_label", htmlFor: this.attribs.id }, this.label));
        }
        else {
            return S.e('span', { key: this.attribs.id + "_span" }, S.e('input', this.attribs));
        }
    }
}
