import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { store } from "./AppRedux";
import { AppState } from "./AppState";
import clientInfo from "./ClientInfo";
import { Constants as C } from "./Constants";
import { DialogBaseImpl } from "./DialogBaseImpl";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { BaseCompState } from "./widget/base/BaseCompState";
import { Comp } from "./widget/base/Comp";
import { CompIntf } from "./widget/base/CompIntf";
import { Div } from "./widget/Div";
import { Span } from "./widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export abstract class DialogBase<S extends BaseCompState = any> extends Div<S> implements DialogBaseImpl {

    // ref counter that allows multiple dialogs to be opened on top of each other and only
    // when the final one closes out do we go back to enabling scrolling on body again.
    static refCounter = 0;
    static BACKDROP_PREFIX = "backdrop-";
    static backdropZIndex: number = 16000000;
    resolve: Function;

    backdrop: HTMLElement;

    /* Warning: Base 'Comp' already has 'state', I think it was wrong to rely on 'appState' everywhere inside dialogs, because
    we need to just let the render methods grab the latest state like every other component in the render method.
    */
    appState: AppState;

    /* this is a slight hack so we can ignore 'close()' calls that are bogus */
    opened: boolean = false;

    /* I added this capability to make the internals of the dialog scroll, but didn't like it ultimately */
    internalScrolling: boolean = false;

    constructor(public title: string, private overrideClass: string, private closeByOutsideClick: boolean, appState: AppState) {
        super(null);
        this.appState = appState;

        this.attribs.className = clientInfo.isMobile
            ? (this.closeByOutsideClick ? "app-modal-content-almost-fullscreen" : "app-modal-content-fullscreen")
            : (this.overrideClass ? this.overrideClass : "app-modal-content");
    }

    /* To open any dialog all we do is construct the object and call open(). Returns a promise that resolves when the dialog is
    closed. */
    open = (display: string = null): Promise<DialogBase> => {
        this.opened = true;
        return new Promise<DialogBase>(async (resolve, reject) => {

            // Create dialog container and attach to document.body.
            this.backdrop = document.createElement("div");
            this.backdrop.setAttribute("id", DialogBase.BACKDROP_PREFIX + this.getId());

            // WARNING: Don't use 'className' here, this is pure javascript.
            this.backdrop.setAttribute("class", "app-modal");
            this.backdrop.setAttribute("style", "z-index: " + (++DialogBase.backdropZIndex));
            document.body.appendChild(this.backdrop);

            // clicking outside the dialog will close it. We only use this for the main menu of the app, because clicking outside a dialog
            // is too easy to do while your editing and can cause loss of work/editing.
            if (this.closeByOutsideClick) {
                this.backdrop.addEventListener("click", (evt: any) => {
                    // get our dialog itself.
                    const contentElm: any = S.util.domElm(this.getId());

                    // check if the click was outside the dialog.
                    if (!!contentElm && !contentElm.contains(evt.target)) {
                        this.close();
                    }
                });
            }

            /* If the dialog has a function to load from server, call here first */
            const queryServerPromise = this.preLoad();
            if (queryServerPromise) {
                await queryServerPromise;
            }

            // this renders the dlgComp onto the screen (on the backdrop elm)
            this.domRender();

            if (++DialogBase.refCounter === 1) {
                /* we only hide and reshow the scroll bar and disable scrolling when we're in mobile mode, because that's when
                full-screen dialogs are in use, which is when we need this. */
                if (clientInfo.isMobile) {
                    document.body.style.overflow = "hidden";
                }
            }

            this.resolve = resolve;
        });
    }

    /* NOTE: preLoad is always forced to complete BEFORE any dialog GUI is allowed to render in case we need to
    get information from the server before displaying the dialog. This is optional. Many dialogs of course don't need to get data
    from the server before displaying */
    preLoad(): Promise<void> {
        return null;
    }

    domRender(): void {
        const reactElm = S.e(this._render, this.attribs);

        // console.log("Rendering with provider");
        const provider = S.e(Provider, { store }, reactElm);
        ReactDOM.render(provider, this.backdrop);
    }

    public close = () => {
        if (!this.opened) return;
        this.opened = false;
        this.resolve(this);
        if (this.getElement()) {
            ReactDOM.unmountComponentAtNode(this.backdrop);
            S.util.domElmRemove(this.getId());
            S.util.domElmRemove(DialogBase.BACKDROP_PREFIX + this.getId());

            if (--DialogBase.refCounter <= 0) {
                if (clientInfo.isMobile) {
                    document.body.style.overflow = "auto";
                }
            }
        }
    }

    abstract renderDlg(): CompIntf[];
    abstract renderButtons(): CompIntf;

    /* Can be overridden to customize content (normally icons) in title bar */
    getExtraTitleBarComps(): CompIntf[] {
        return null;
    }

    getTitleIconComp(): CompIntf {
        return null;
    }

    getTitleText(): string {
        return null;
    }

    preRender(): void {
        let timesIcon: Comp;
        // Dialog Header with close button (x) right justified on it.
        const children: CompIntf[] = [];

        const titleIconComp: CompIntf = this.getTitleIconComp();
        const titleText: string = this.getTitleText();
        const extraHeaderComps = this.getExtraTitleBarComps();
        let titleChildren: CompIntf[] = [titleIconComp, new Span(titleText || this.title)];

        if (extraHeaderComps) {
            titleChildren = titleChildren.concat(extraHeaderComps);
        }

        titleChildren = titleChildren.concat(timesIcon = new Span("&times;", {
            className: "float-right app-modal-title-close-icon",
            onClick: this.close
        }));

        // NOTE: title will be null for the main menu, which is actually implemented as a dialog using this base class.
        if (this.title) {
            children.push(new Div(null, {
                className: "app-modal-title"
            },
            titleChildren
            ));
            timesIcon.renderRawHtml = true;
        }

        let contentAttribs: any = null;

        /* This will make the content area of the dialog above the buttons be scrollable, with a max size that is the full
        page size before scrolling. This scrolling makes the dialog buttons always stay visible and not themselves scroll */
        if (this.internalScrolling) {
            const style = {
                maxHeight: "" + (S.meta64.deviceHeight - S.meta64.navBarHeight - 50) + "px"
            };
            contentAttribs = {
                className: "dialogContentArea",
                style
            };
        }

        const contentDiv = new Div(null, contentAttribs, this.renderDlg());

        children.push(contentDiv);
        children.push(this.renderButtons());

        this.setChildren(children);
    }
}
