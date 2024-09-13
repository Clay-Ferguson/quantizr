import { dispatch, getAs } from "./AppContext";
import { S } from "./Singletons";
import { Validator } from "./Validator";
import { Comp } from "./comp/base/Comp";
import { Div } from "./comp/core/Div";
import { Icon } from "./comp/core/Icon";
import { Span } from "./comp/core/Span";

export abstract class DialogBase extends Comp {
    static backdropZIndex: number = 16000000; // z-index
    static scrollPos: any = {};
    resolve: (dlg: DialogBase) => void;

    aborted: boolean = false;
    backdrop: HTMLElement;

    /* this is a slight hack so we can ignore 'close()' calls that are bogus */
    opened: boolean = false;
    loaded: boolean = false;

    validatedStates: Validator[] = null;
    zIndex: number = DialogBase.backdropZIndex;

    isDown: boolean;
    dragged: boolean;
    offsetX: number = 0;
    offsetY: number = 0;
    lastPosX: number = 0;
    lastPosY: number = 0;
    widthForDragging: number = window.innerWidth;
    heightForDragging: number = window.innerHeight;
    dlgWidth: string = "600px";
    dlgFrame: Div;
    titleDiv: Div;

    /*
    NOTE: the 'popup' option/arg was experimental and does work just fine, but one additional thing
    is needed which is to store the browser scroll position in the dialog, so it can be restored
    back after editing is complete, and the experimental overrideClass used for testing was
    "embedded-dlg"
    */
    constructor(public title: string, private overrideClass: string = null, private closeByOutsideClick: string = null, public mode: DialogMode = null, public forceMode: boolean = false) {
        super({ id: "dlg_" + getAs().dialogStack.length });
        const ast = getAs();
        this.title = this.title || "Message";

        // if no mode is given assume it based on whether mobile or not, or if this is mobile then also force fullscreen.
        if (!forceMode && (!this.mode || ast.mobileMode)) {
            this.mode = ast.mobileMode ? DialogMode.FULLSCREEN : DialogMode.POPUP;
        }
    }

    /* To open any dialog all we do is construct the object and call open(). Returns a promise that
    resolves when the dialog is closed. */
    open = (): Promise<DialogBase> => {
        this.opened = true;

        // We use an actual Promise and not async/await because our resolve function is held long
        // term, and represents the closing of the dialog.
        return new Promise<DialogBase>(resolve => {
            if (this.mode === DialogMode.POPUP) {
                this.zIndex = ++DialogBase.backdropZIndex;
            }

            /* If the dialog has a function to load from server, call here first */
            const preLoadPromise = this.preLoad() || Promise.resolve();

            preLoadPromise.then(() => {
                dispatch("OpenDialog", s => {
                    // adding to dialogStack will cause it to be rendered by main App component.
                    s.dialogStack.push(this);

                    // opening first dialog in mobile mode
                    if (this.mode === DialogMode.POPUP && s.mobileMode && s.dialogStack.length === 1) {
                        document.body.style.overflow = "hidden";
                    }
                });

                this.resolve = resolve;
            });
        });
    }

    /* NOTE: preLoad is always forced to complete BEFORE any dialog GUI is allowed to render in case
    we need to get information from the server before displaying the dialog. This is optional. Many
    dialogs of course don't need to get data from the server before displaying */
    async preLoad(): Promise<any> {
        return null;
    }

    public abort = () => {
        if (this.aborted) return;
        this.aborted = true;
        setTimeout(this._close, 100);
    }

    closeByUser() {
    }

    // bound to this
    _close = () => {
        this.close();
    }

    close() {
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
        });
    }

    preUnmount(): any {
    }

    abstract renderDlg(): Comp[];

    /* Can be overridden to customize content (normally icons) in title bar */
    getExtraTitleBarComps(): Comp[] {
        return null;
    }

    getTitleIconComp(): Comp {
        return null;
    }

    getTitleText(): string {
        return null;
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const isTopmost = this.isTopmost();

        const width = this.genInitWidth();
        this.dlgWidth = width + "px";
        if (!this.dragged) {
            this.lastPosX = ((window.innerWidth - width) / 2);
        }

        this.checkPositionBounds();
        let useTitle = this.getTitleText() || this.title;
        if (useTitle === "[none]") useTitle = null;

        const titleChildren: Comp[] = [
            this.getTitleIconComp(),
            useTitle ? new Span(useTitle) : null,
            ...(this.getExtraTitleBarComps() || []), // spread operator chokes on null arrays so we check here

            new Div(null, { className: "dlgModalTitleCloseIcon float-end" }, [
                new Icon({
                    className: "fa fa-times fa-lg",
                    onClick: () => {
                        this.closeByUser();
                        this.close();
                    },
                    title: "Close Dialog"
                })
            ])
        ];

        let extraTitleClass = "";
        let contentAreaClass = "";

        // this 'closeByOutsideClick' and a other uses of that variable in here also really need to be
        // 'isMenu' instead.
        if (this.mode === DialogMode.POPUP && !this.closeByOutsideClick) {
            extraTitleClass = (isTopmost ? " dlgTitleTopmost" : "dlgTitleNormal");
            contentAreaClass = "appModalContentAreaPopup" + (isTopmost ? " dlgContentBorderTopmost" : " dlgContentBorderNormal");
        }
        else {
            contentAreaClass = ast.mobileMode ? "" : "appModalContentAreaEmbed";
        }

        this.children = [
            // It's tricky but 'closeByOutsideClick' means this is a "menu", so, no title.
            this.title && !this.closeByOutsideClick ? (this.titleDiv = new Div(null, {
                className: (this.mode === DialogMode.POPUP ? "appModalTitlePopup " : "appModalTitleNormal ") +
                    extraTitleClass
            },
                [
                    new Div(null, { className: ast.mobileMode ? "dlgTitleContentMobile" : "dlgTitleContent" }, titleChildren),
                    this.mode === DialogMode.POPUP ? new Div(null, { className: "line" }) : null
                ]
            )) : null,
            new Div(null, {
                className: contentAreaClass
            }, this.renderDlg())
        ];


        if (this.mode === DialogMode.FULLSCREEN) {
            this.attribs.className = "appModalContFullscreen";
            this.attribs.style = { zIndex: this.zIndex };
        }
        else {
            const clazzName = ast.mobileMode
                ? (this.closeByOutsideClick ? "appModalMainMenu" : "appModalContFullscreen")
                : (this.overrideClass ? this.overrideClass : "appModalCont");

            // if fullscreen we render without backdrop
            if (this.mode !== DialogMode.POPUP) {
                this.attribs.className = clazzName;
            }
            // else wrap dialog in backdrop
            else {
                this.attribs.className = (isTopmost ? "appModalTopBackdrop " : "appModalBackdrop ") + "customScrollbar";
                this.attribs.style = { zIndex: this.zIndex };
                this.attribs.onClick = (evt: Event) => {
                    if (this.closeByOutsideClick) {
                        const dlgElm: any = S.domUtil.domElm(this.closeByOutsideClick);
                        // check if the click was outside the dialog.
                        if (!!dlgElm && !dlgElm.contains(evt.target)) {
                            this.close();
                        }
                    }
                }

                const children = this.children
                this.children = [
                    this.dlgFrame = new Div(null, {
                        id: this.getId(),
                        className: clazzName,
                        style: {
                            left: this.lastPosX + "px",
                            top: this.lastPosY + "px",
                            width: this.dlgWidth
                        }
                    }, children)
                ];

                if (!ast.mobileMode && this.dlgFrame && this.titleDiv) {
                    this.makeDraggable(this.dlgFrame, this.titleDiv);
                }
            }
        }
        return true;
    }

    checkPositionBounds = () => {
        if (this.lastPosX > this.widthForDragging - 100) {
            this.lastPosX = this.widthForDragging - 100;
        }

        if (this.lastPosY > this.heightForDragging - 100) {
            this.lastPosY = this.heightForDragging - 100;
        }

        if (this.lastPosX < 0) {
            this.lastPosX = 0;
        }

        const tourPanelElm = document.getElementById("tourPanelId");
        if (tourPanelElm) {
            if (this.lastPosY < tourPanelElm.offsetHeight) {
                this.lastPosY = tourPanelElm.offsetHeight;
            }
        }
        else {
            if (this.lastPosY < 0) {
                this.lastPosY = 0;
            }
        }
    }

    genInitWidth = (): number => {
        let width = 800;
        if (this.overrideClass) {
            if (this.overrideClass.indexOf("appModalContTinyWidth") !== -1) {
                width = 350;
            }
            else if (this.overrideClass.indexOf("appModalContNarrowWidth") !== -1) {
                width = 500;
            }
            else if (this.overrideClass.indexOf("appModalContMediumWidth") !== -1) {
                width = 650;
            }
        }
        return width;
    }

    isTopmost = () => {
        const ast = getAs();
        if (ast.dialogStack.length < 2) return true;
        return this === ast.dialogStack[ast.dialogStack.length - 1];
    }

    makeDraggable = (dragDiv: Div, clickDiv: Div) => {
        if (!this.isTopmost()) {
            return;
        }
        this.isDown = false;

        clickDiv._domAddEvent = () => {
            const clickDivElm: HTMLElement = clickDiv.getRef();

            clickDivElm.addEventListener("mousedown", (e) => {
                if (!this.isTopmost()) return;

                // only accept left-button click
                if (e.button !== 0) return;

                const elm: HTMLElement = this.getRef();
                if (!elm) return;

                /* If the dialog panel container scrolling area has been scrolled the only reason
                for doing that would be to see more of the dialog itself, so if user starts dragging
                it in this case we always just want to reset scrolling back to zero and reposition
                from scratch as if dialog had just now come up. */
                if (elm.scrollTop > 0 || elm.scrollLeft > 0) {
                    elm.scrollTop = 0;
                    elm.scrollLeft = 0;
                    const width = this.genInitWidth();
                    this.lastPosX = ((window.innerWidth - width) / 2);
                    this.lastPosY = 0;

                    const dragDivElm: HTMLElement = dragDiv.getRef();
                    if (dragDivElm) {
                        dragDivElm.style.left = this.lastPosX + "px";
                        dragDivElm.style.top = this.lastPosY + "px";
                    }
                    return;
                }

                const dragDivElm: HTMLElement = dragDiv.getRef();
                if (dragDivElm) {
                    this.offsetX = dragDivElm.offsetLeft - e.clientX;
                    this.offsetY = dragDivElm.offsetTop - e.clientY;
                    this.isDown = true;
                    this.dragged = true;

                    this.widthForDragging = window.innerWidth;
                    this.heightForDragging = window.innerHeight;
                }
            }/*, true */);
        }

        this._domAddEvent = () => {
            const elm: HTMLElement = this.getRef();
            if (!elm) return;

            elm.addEventListener("mouseup", () => {
                if (!this.isTopmost()) return;
                this.isDown = false;
            }/*, true */);

            elm.addEventListener("mousemove", (e) => {
                if (!this.isTopmost()) return;
                // e.preventDefault();
                // e.stopPropagation();

                if (this.isDown) {
                    this.lastPosX = e.clientX + this.offsetX;
                    this.lastPosY = e.clientY + this.offsetY;
                    this.checkPositionBounds();

                    const dragDivElm: HTMLElement = dragDiv.getRef();
                    if (dragDivElm) {
                        dragDivElm.style.left = this.lastPosX + "px";
                        dragDivElm.style.top = this.lastPosY + "px";
                    }
                }
            }/*, true */);
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

    override getScrollPos(): number {
        return DialogBase.scrollPos[this.zIndex] || 0;
    }

    override setScrollPos(pos: number): void {
        DialogBase.scrollPos[this.zIndex] = pos;
    }
}

export enum DialogMode {
    // eslint-disable-next-line no-unused-vars
    POPUP, FULLSCREEN
}
