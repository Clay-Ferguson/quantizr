import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { DialogBaseImpl } from "./DialogBaseImpl";
import { DialogMode } from "./enums/DialogMode";
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
    static backdropZIndex: number = 16000000; // z-index

    // NOTE: resolve function stays null for EMBED mode.
    resolve: Function;

    aborted: boolean = false;

    backdrop: HTMLElement;

    /* Warning: Base 'Comp' already has 'state', I think it was wrong to rely on 'appState' everywhere inside dialogs, because
    we need to just let the render methods grab the latest state like every other component in the render method.
    */
    appState: AppState;

    /* this is a slight hack so we can ignore 'close()' calls that are bogus, and doesn't apply to the EMBED mode */
    opened: boolean = false;
    loaded: boolean = false;

    /* I added this capability to make the internals of the dialog scroll, but didn't like it ultimately */
    internalScrolling: boolean = false;

    /*
    NOTE: the 'popup' option/arg was experimental and does work just fine, but one additional thing is needed
    which is to store the browser scroll position in the dialog, so it can be restored back after editing is complete, and the
    experimental overrideClass used for testing was "embedded-dlg"
    */
    constructor(public title: string, private overrideClass: string, private closeByOutsideClick: boolean, appState: AppState, public mode: DialogMode = null, public forceMode: boolean = false) {
        super(null);
        this.close = this.close.bind(this);

        this.appState = appState;

        // new on 3/14/2021 (MessageDlg sending null into here)
        if (!appState) {
            this.appState = store.getState();
        }

        // if no mode is given assume it based on whether mobile or not, or if this is mobile then also force fullscreen.
        if (!forceMode && (!this.mode || this.appState.mobileMode)) {
            this.mode = this.appState.mobileMode ? DialogMode.FULLSCREEN : DialogMode.POPUP;
        }

        if (this.mode === DialogMode.EMBED) {
            this.attribs.className = this.overrideClass;
        }
        else if (this.mode === DialogMode.FULLSCREEN) {
            this.attribs.className = "app-modal-content-fullscreen";
        }
        else {
            this.attribs.className = this.appState.mobileMode
                ? (this.closeByOutsideClick ? "app-modal-main-menu" : "app-modal-content-fullscreen")
                : (this.overrideClass ? this.overrideClass : "app-modal-content");
        }
    }

    /* To open any dialog all we do is construct the object and call open(). Returns a promise that resolves when the dialog is
    closed. */
    open = (display: string = null): Promise<DialogBase> => {
        if (this.mode === DialogMode.EMBED) {
            return;
        }
        this.opened = true;

        // We use an actual Promise and not async/await because our resolve function is held long term, and
        // represents the closing of the dialog.
        return new Promise<DialogBase>(async (resolve, reject) => {
            if (this.mode === DialogMode.POPUP) {
                // Create dialog container and attach to document.body.
                this.backdrop = document.createElement("div");
                this.backdrop.setAttribute("id", DialogBase.BACKDROP_PREFIX + this.getId());

                // WARNING: Don't use 'className' here, this is pure javascript, and not React!
                this.backdrop.setAttribute("class", "app-modal " + (this.appState.mobileMode ? "normalScrollbar" : "customScrollbar"));
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
            }

            /* If the dialog has a function to load from server, call here first */
            const queryServerPromise = this.preLoad();
            if (queryServerPromise) {
                await queryServerPromise;
            }

            if (this.mode === DialogMode.POPUP) {
                // this renders the dlgComp onto the screen (on the backdrop elm)
                this.domRender();

                if (++DialogBase.refCounter === 1) {
                    /* we only hide and reshow the scroll bar and disable scrolling when we're in mobile mode, because that's when
                    full-screen dialogs are in use, which is when we need this. */
                    if (this.appState.mobileMode) {
                        document.body.style.overflow = "hidden";
                    }
                }
            }
            else {
                dispatch("Action_OpenDialog", (s: AppState): AppState => {
                    s.dialogStack.push(this);
                    return s;
                });
            }

            this.resolve = resolve;
        });
    }

    /* NOTE: preLoad is always forced to complete BEFORE any dialog GUI is allowed to render (excepet in EMBED mode) in case we need to
    get information from the server before displaying the dialog. This is optional. Many dialogs of course don't need to get data
    from the server before displaying */
    async preLoad(): Promise<void> {
        return null;
    }

    domRender(): void {
        const reactElm = this.e(this._render, this.attribs);

        // console.log("Rendering with provider");
        const provider = this.e(Provider, { store }, reactElm);
        ReactDOM.render(provider, this.backdrop);
    }

    public abort = (): void => {
        if (this.aborted) return;
        this.aborted = true;
        setTimeout(() => {
            this.close();
        }, 100);
    }

    public close(): void {
        if (this.mode === DialogMode.EMBED) {
            return;
        }

        if (!this.opened) return;
        this.opened = false;
        this.resolve(this);

        if (this.mode === DialogMode.POPUP) {
            if (this.getRef()) {
                this.preUnmount();
                ReactDOM.unmountComponentAtNode(this.backdrop);
                S.util.domElmRemove(this.getId());
                S.util.domElmRemove(DialogBase.BACKDROP_PREFIX + this.getId());

                if (--DialogBase.refCounter <= 0) {
                    if (this.appState.mobileMode) {
                        document.body.style.overflow = "auto";
                    }
                }
            }
        }
        else {
            dispatch("Action_CloseDialog", (s: AppState): AppState => {
                const index = s.dialogStack.indexOf(this);
                if (index > -1) {
                    s.dialogStack.splice(index, 1);
                }
                return s;
            });
        }
    }

    preUnmount(): any {
    }

    abstract renderDlg(): CompIntf[];

    renderButtons(): CompIntf {
        return null;
    }

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
        let useTitle = titleText || this.title;

        // slight hack. we need a 'showTitle' flag separately (todo-1)
        if (useTitle === "[none]") useTitle = null;
        let titleChildren: CompIntf[] = [titleIconComp,
            useTitle ? new Span(useTitle) : null
        ];

        if (extraHeaderComps) {
            titleChildren = titleChildren.concat(extraHeaderComps);
        }

        titleChildren = titleChildren.concat(timesIcon = new Span("&times;", {
            className: "float-end app-modal-title-close-icon",
            onClick: this.close,
            title: "Close Dialog"
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
                maxHeight: "" + (window.innerHeight - 50) + "px"
            };
            contentAttribs = {
                className: "dialogContentArea",
                style
            };
        }

        let renderComps: CompIntf[] = null;
        try {
            renderComps = this.renderDlg();
        }
        catch (ex) {
            S.util.logAndReThrow("renderDlg failed on " + this.getId(), ex);
        }
        const contentDiv = new Div(null, contentAttribs, renderComps);
        children.push(contentDiv);

        let buttons: CompIntf = this.renderButtons();
        if (buttons) {
            children.push(buttons);
        }

        this.setChildren(children);
    }
}
