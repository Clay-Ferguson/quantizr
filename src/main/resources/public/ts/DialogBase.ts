import { createElement } from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { dispatch, getAppState, store } from "./AppRedux";
import { CompIntf } from "./comp/base/CompIntf";
import { Div } from "./comp/core/Div";
import { Icon } from "./comp/core/Icon";
import { Span } from "./comp/core/Span";
import { S } from "./Singletons";
import { Validator } from "./Validator";

export abstract class DialogBase extends Div {

    // ref counter that allows multiple dialogs to be opened on top of each other and only
    // when the final one closes out do we go back to enabling scrolling on body again.
    static refCounter = 0;
    static BACKDROP_PREFIX = "backdrop-";
    static backdropZIndex: number = 16000000; // z-index

    // NOTE: resolve function stays null for EMBED mode.
    resolve: Function;

    aborted: boolean = false;

    backdrop: HTMLElement;

    /* this is a slight hack so we can ignore 'close()' calls that are bogus, and doesn't apply to the EMBED mode */
    opened: boolean = false;
    loaded: boolean = false;

    validatedStates: Validator[] = null;

    /*
    NOTE: the 'popup' option/arg was experimental and does work just fine, but one additional thing is needed
    which is to store the browser scroll position in the dialog, so it can be restored back after editing is complete, and the
    experimental overrideClass used for testing was "embedded-dlg"
    */
    constructor(public title: string, private overrideClass: string = null, private closeByOutsideClick: boolean = false, public mode: DialogMode = null, public forceMode: boolean = false) {
        super(null);
        const appState = getAppState();

        // if no mode is given assume it based on whether mobile or not, or if this is mobile then also force fullscreen.
        if (!forceMode && (!this.mode || appState.mobileMode)) {
            this.mode = appState.mobileMode ? DialogMode.FULLSCREEN : DialogMode.POPUP;
        }

        if (this.mode === DialogMode.EMBED) {
            this.attribs.className = this.overrideClass;
        }
        else if (this.mode === DialogMode.FULLSCREEN) {
            this.attribs.className = "app-modal-content-fullscreen";
        }
        else {
            this.attribs.className = appState.mobileMode
                ? (this.closeByOutsideClick ? "app-modal-main-menu" : "app-modal-content-fullscreen")
                : (this.overrideClass ? this.overrideClass : "app-modal-content");
        }
    }

    /* To open any dialog all we do is construct the object and call open(). Returns a promise that resolves when the dialog is
    closed. */
    open = (): Promise<DialogBase> => {
        if (this.mode === DialogMode.EMBED) {
            return;
        }
        this.opened = true;

        // We use an actual Promise and not async/await because our resolve function is held long term, and
        // represents the closing of the dialog.
        return new Promise<DialogBase>(async (resolve, reject) => {
            const appState = getAppState();
            if (this.mode === DialogMode.POPUP) {
                // Create dialog container and attach to document.body.
                this.backdrop = document.createElement("div");
                this.backdrop.setAttribute("id", this.getId(DialogBase.BACKDROP_PREFIX));

                // WARNING: Don't use 'className' here, this is pure javascript, and not React!
                this.backdrop.setAttribute("class", "app-modal " + (appState.mobileMode ? "normalScrollbar" : "customScrollbar"));
                this.backdrop.setAttribute("style", "z-index: " + (++DialogBase.backdropZIndex));
                document.body.appendChild(this.backdrop);

                // clicking outside the dialog will close it. We only use this for the main menu of the app, because clicking outside a dialog
                // is too easy to do while your editing and can cause loss of work/editing.
                if (this.closeByOutsideClick) {
                    this.backdrop.addEventListener("click", (evt: any) => {
                        // get our dialog itself.
                        const contentElm: any = S.domUtil.domElm(this.getId());

                        // check if the click was outside the dialog.
                        if (!!contentElm && !contentElm.contains(evt.target)) {
                            this.close();
                        }
                    });
                }
            }

            /* If the dialog has a function to load from server, call here first */
            const preLoadPromise = this.preLoad();
            if (preLoadPromise) {
                await preLoadPromise;
            }

            if (this.mode === DialogMode.POPUP) {
                // this renders the dlgComp onto the screen (on the backdrop elm)
                this.domRender();

                if (++DialogBase.refCounter === 1) {
                    /* we only hide and reshow the scroll bar and disable scrolling when we're in mobile mode, because that's when
                    full-screen dialogs are in use, which is when we need this. */
                    if (appState.mobileMode) {
                        document.body.style.overflow = "hidden";
                    }
                }
            }
            else {
                dispatch("OpenDialog", s => {
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
    async preLoad(): Promise<any> {
        return null;
    }

    domRender(): void {
        // console.log("Rendering with provider");
        const provider = createElement(Provider, { store }, this.create());
        ReactDOM.render(provider, this.backdrop);
    }

    public abort = () => {
        if (this.aborted) return;
        this.aborted = true;
        setTimeout(() => {
            this.close();
        }, 100);
    }

    closeByUser = () => {
        // derived classes can hook into this to detect that it was a user click that closed the dialog
    }

    close = () => {
        if (this.mode === DialogMode.EMBED) {
            return;
        }

        if (!this.opened) return;
        this.opened = false;
        this.resolve(this);
        const appState = getAppState();

        if (this.mode === DialogMode.POPUP) {
            if (this.getRef()) {
                this.preUnmount();
                ReactDOM.unmountComponentAtNode(this.backdrop);
                S.domUtil.domElmRemove(this.getId());
                S.domUtil.domElmRemove(this.getId(DialogBase.BACKDROP_PREFIX));

                if (--DialogBase.refCounter <= 0) {
                    if (appState.mobileMode) {
                        document.body.style.overflow = "auto";
                    }
                }
            }
        }
        else {
            dispatch("CloseDialog", s => {
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
        let useTitle = this.getTitleText() || this.title;
        if (useTitle === "[none]") useTitle = null;

        const titleChildren: CompIntf[] = [
            this.getTitleIconComp(),
            useTitle ? new Span(useTitle) : null,
            ...(this.getExtraTitleBarComps() || []), // spread operator chokes on null arrays so we check here
            new Div(null, { className: "app-modal-title-close-icon float-end" }, [
                new Icon({
                    className: "fa fa-times",
                    onClick: () => {
                        this.closeByUser();
                        this.close();
                    },
                    title: "Close Dialog"
                })
            ])
        ];

        this.setChildren([
            this.title ? new Div(null, {
                className: "app-modal-title"
            },
                titleChildren) : null,
            new Div(null, null, this.renderDlg())
        ]);
    }

    validate = (): boolean => {
        if (!this.validatedStates) return true;

        let valid = true;
        this.validatedStates.forEach(vs => {
            if (!vs.validate()) valid = false;
        });

        if (!valid) {
            console.log("validate()=false in " + this.getCompClass());
        }
        return valid;
    }
}

export enum DialogMode {
    // eslint-disable-next-line no-unused-vars
    POPUP, EMBED, FULLSCREEN
};
