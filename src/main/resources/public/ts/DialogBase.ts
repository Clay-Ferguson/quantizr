import { DialogBaseImpl } from "./DialogBaseImpl";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { Comp } from "./widget/base/Comp";
import { Div } from "./widget/Div";
import * as ReactDOM from "react-dom";
import { CompIntf } from "./widget/base/CompIntf";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export abstract class DialogBase extends Comp implements DialogBaseImpl {

    static backdropZIndex: number = 16000000;
    resolve: Function;

    constructor(public title: string, private overrideClass: string = null, private closeByOutsideClick: boolean = false,
        private initiallyInvisible: boolean = false) {
        super(null);
    }

    init = () => {
    }

    /* To open any dialog all we do is construct the object and call open(). Returns a promise that resolves when the dialog is 
    closed. */
    open = (): Promise<DialogBase> => {
        return new Promise<DialogBase>((resolve, reject) => {
            let displayStyle = this.initiallyInvisible ? "none" : "block";

            // Create dialog container and attach to document.body.
            let elm = document.createElement('div');
            elm.setAttribute("id", this.getId());

            // WARNING: Don't use 'className' here, this is pure javascript.
            elm.setAttribute("class", "app-modal");
            elm.setAttribute("style", "z-index: " + (++DialogBase.backdropZIndex) + "; display: " + displayStyle + ";");
            document.body.appendChild(elm);

            let dlgComp = this.makeComp(elm);
            ReactDOM.render(S.e(dlgComp.render, dlgComp.attribs), elm);

            this.init();
            this.resolve = resolve;
        });
    }

    //DO NOT DELETE.
    //example override pattern.
    // superClose : Function = this.close;
    // close = () => {
    //     this.superClose();
    // }

    public close = () => {
        this.resolve(this);
        S.util.domElmRemove(this.getId());
    }

    makeComp = (backdrop: HTMLElement): Comp => {
        let content: CompIntf[] = this.title ? [new Div(this.title, {
            className: "app-modal-title"
        })] : [];

        content = content.concat(this.children);
        
        /* Display dialogs fullscreen on mobile devices */
        let clazz = S.meta64.isMobile ? "app-modal-content-fullscreen" : "app-modal-content";

        // Note this optionally uses overrideClass which can come from above
        let contentDiv = new Div(null, {
            className: this.overrideClass ? this.overrideClass : clazz
        }, content)

        //clicking outside the dialog will close it. We only use this for the main menu of the app, because clicking outside a dialog
        //is too easy to do while your editing and can cause loss of work/editing.
        if (this.closeByOutsideClick) {
            backdrop.addEventListener("click", (evt: any) => {
                //get our dialog itself.
                let contentElm = S.util.domElm(contentDiv.getId());

                //check if the click was outside the dialog.
                if (!!contentElm && !contentElm.contains(evt.target)) {
                    this.close();
                }
            });
        }

        return contentDiv;
    }
}
