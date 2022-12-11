import { ReactNode } from "react";
import { dispatch, getAppState } from "./AppContext";
import { Comp } from "./comp/base/Comp";
import { CompIntf } from "./comp/base/CompIntf";
import { Div } from "./comp/core/Div";
import { Icon } from "./comp/core/Icon";
import { Span } from "./comp/core/Span";
import { S } from "./Singletons";
import { Validator } from "./Validator";

export abstract class DialogBase extends Comp {
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
    zIndex: number = DialogBase.backdropZIndex;

    /*
    NOTE: the 'popup' option/arg was experimental and does work just fine, but one additional thing is needed
    which is to store the browser scroll position in the dialog, so it can be restored back after editing is complete, and the
    experimental overrideClass used for testing was "embedded-dlg"
    */
    constructor(public title: string, private overrideClass: string = null, private closeByOutsideClick: boolean = false, public mode: DialogMode = null, public forceMode: boolean = false) {
        super(null);
        const ast = getAppState();

        // if no mode is given assume it based on whether mobile or not, or if this is mobile then also force fullscreen.
        if (!forceMode && (!this.mode || ast.mobileMode)) {
            this.mode = ast.mobileMode ? DialogMode.FULLSCREEN : DialogMode.POPUP;
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
            if (this.mode === DialogMode.POPUP) {
                this.zIndex = ++DialogBase.backdropZIndex;
            }

            /* If the dialog has a function to load from server, call here first */
            const preLoadPromise = this.preLoad();
            if (preLoadPromise) {
                await preLoadPromise;
            }

            dispatch("OpenDialog", s => {
                // adding to dialogStack will cause it to be rendered by main App component.
                s.dialogStack.push(this);

                // opening first dialog in mobile mode
                if (this.mode === DialogMode.POPUP && s.mobileMode && s.dialogStack.length === 1) {
                    document.body.style.overflow = "hidden";
                }
                return s;
            });

            this.resolve = resolve;
        });
    }

    /* NOTE: preLoad is always forced to complete BEFORE any dialog GUI is allowed to render (excepet in EMBED mode) in case we need to
    get information from the server before displaying the dialog. This is optional. Many dialogs of course don't need to get data
    from the server before displaying */
    async preLoad(): Promise<any> {
        return null;
    }

    public abort = () => {
        if (this.aborted) return;
        this.aborted = true;
        setTimeout(this.close, 100);
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

        dispatch("CloseDialog", s => {
            const index = s.dialogStack.indexOf(this);
            if (index > -1) {
                s.dialogStack.splice(index, 1);
            }

            // if just closed last dialog (no more dialogs open)
            if (this.mode === DialogMode.POPUP && s.mobileMode && s.dialogStack.length === 0) {
                document.body.style.overflow = "auto";
            }
            return s;
        });
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

    compRender = (): ReactNode => {
        const ast = getAppState();
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

        if (this.mode === DialogMode.EMBED) {
            this.attribs.className = this.overrideClass;
            return this.tag("div");
        }
        else if (this.mode === DialogMode.FULLSCREEN) {
            this.attribs.className = "app-modal-content-fullscreen";
            return this.tag("div");
        }
        else {
            const clazzName = ast.mobileMode
                ? (this.closeByOutsideClick ? "app-modal-main-menu" : "app-modal-content-fullscreen")
                : (this.overrideClass ? this.overrideClass : "app-modal-content");

            // if fullscreen we render without backdrop
            if (this.mode !== DialogMode.POPUP) {
                this.attribs.className = clazzName;
                return this.tag("div");
            }
            // else wrap dialog in backdrop
            else {
                return this.tag("div", {
                    id: this.getId(DialogBase.BACKDROP_PREFIX),
                    className: "app-modal " + (ast.mobileMode ? "normalScrollbar" : "customScrollbar"),
                    style: { zIndex: this.zIndex },
                    onClick: (evt: Event) => {
                        if (this.closeByOutsideClick) {
                            const dlgElm: any = S.domUtil.domElm(this.getId());
                            // check if the click was outside the dialog.
                            if (!!dlgElm && !dlgElm.contains(evt.target)) {
                                this.close();
                            }
                        }
                    }
                }, [
                    new Div(null, { id: this.getId(), className: clazzName }, this.getChildren())
                ]);
            }
        }
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
