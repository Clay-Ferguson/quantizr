import { DialogBaseImpl } from "./DialogBaseImpl";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";
import { Comp } from "./widget/base/Comp";
import { Div } from "./widget/Div";
import { Span } from "./widget/Span";
import * as ReactDOM from "react-dom";
import { CompIntf } from "./widget/base/CompIntf";
import { Icon } from "./widget/Icon";


let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export abstract class DialogBase extends Comp implements DialogBaseImpl {

    //ref counter that allows multiple dialogs to be opened on top of each other and only
    //when the final one closes out do we go back to enabling scrolling on body again.
    static refCounter = 0;

    static backdropZIndex: number = 16000000;
    resolve: Function;

    elm: HTMLElement;
    dlgComp: Comp;

    constructor(public title: string, private overrideClass: string = null, private closeByOutsideClick: boolean = false,
        private initiallyInvisible: boolean = false) {
        super(null);
    }

    /* To be overridden by derived classes */
    init = () => {
    }

    /* To open any dialog all we do is construct the object and call open(). Returns a promise that resolves when the dialog is 
    closed. */
    open = (display: string = null): Promise<DialogBase> => {
        return new Promise<DialogBase>((resolve, reject) => {
            let displayStyle = display ? display : (this.initiallyInvisible ? "none" : "block");

            if (this.initiallyInvisible) {
                this.whenElmEx((elm: HTMLElement) => {
                    elm.style.display = "inline-block";
                });
            }

            // Create dialog container and attach to document.body.
            this.elm = document.createElement('div');
            this.elm.setAttribute("id", this.getId());

            // WARNING: Don't use 'className' here, this is pure javascript.
            this.elm.setAttribute("class", "app-modal");
            this.elm.setAttribute("style", "z-index: " + (++DialogBase.backdropZIndex) + "; display: " + displayStyle + ";");
            document.body.appendChild(this.elm);

            //This basically creates the 'children'
            this.init();

            //this renders the dlgComp onto the screen (on the backdrop elm)
            this.domRender();

            if (++DialogBase.refCounter == 1) {
                /* we only hide and reshow the scroll bar and disable scrolling when we're in mobile mode, because that's when 
                full-screen dialogs are in use, which is when we need this. */
                if (S.meta64.isMobile) {
                    document.body.style.overflow = 'hidden';
                }
            }

            this.resolve = resolve;
        });
    }

    domRender = (): void => {
        //this wraps the childern inside the actual dialog component itself
        this.dlgComp = this.makeComp(this.elm);
        ReactDOM.render(S.e(this.dlgComp.render, this.dlgComp.attribs), this.elm);
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

        if (--DialogBase.refCounter <= 0) {
            if (S.meta64.isMobile) {
                document.body.style.overflow = 'auto';
            }
        }
    }

    /* Returns the single Component to go inside the dialog, which is the entire content of the dialog
    as a Div that contains the header of the dialog and all the 'this.children' appended below it, so we expect
    this.children to already be populated by the time we get in here, which can safely be put in init() to make
    sure they are */
    makeComp = (backdrop: HTMLElement): Comp => {

        let timesIcon: Comp;
        //Dialog Header with close button (x) right justified on it.
        let content: CompIntf[] = [];

        //NOTE: title will be null for the main menu, which is actually implemented as a dialog using this base class.
        if (this.title) {
            content.push(new Div(this.title, {
                className: "app-modal-title"
            },
                [timesIcon = new Span("&times;", {
                    className: "float-right app-modal-title-close-icon",
                    onClick: this.close
                })]
            ));
            timesIcon.renderRawHtml = true;
        }

        content = content.concat(this.children);

        /* Display dialogs fullscreen on mobile devices */
        let clazz = S.meta64.isMobile ?
            (this.closeByOutsideClick ? "app-modal-content-almost-fullscreen" : "app-modal-content-fullscreen") :
            (this.overrideClass ? this.overrideClass : "app-modal-content");

        // Note this optionally uses overrideClass which can come from above
        let contentDiv: Div = new Div(null, {
            className: clazz
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
