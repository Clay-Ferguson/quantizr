import { dispatch } from "./AppContext";
import { Comp } from "./comp/base/Comp";
import { Constants as C } from "./Constants";
import { S } from "./Singletons";

export class DomUtil {
    annotations: HTMLDivElement[] = [];
    mouseX: number;
    mouseY: number;
    mouseCircle: any = null;
    mouseEffect: boolean = false;
    mouseEffectDirty: boolean = true;

    static escapeMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;"
    };

    getPropFromDom = (evt: Event, prop: string): string => {
        let val = null;

        // get the id from this node or any parent node.
        if (evt?.target) {
            let target: any = evt.target;
            while (target) {
                // console.log("Checking target.id " + target.id + " for nid");
                val = target.getAttribute(prop);
                if (val) return val;
                target = target.parentElement;
            }
        }

        // It's normal flow to sometimes return null here. Like deleting from the left hand menu where it calls
        // the same method as the onClick method but there's no event info or node attributes passed in that case,
        // and this is fine.
        return val;
    }

    /* set focus to element by id */
    focusId = (id: string) => {
        if (!id) return;
        // console.log("*** focusId = " + id);
        Comp.focusElmId = id;
        setTimeout(() => {
            // console.log("delayed Focusing Id: " + id);
            const elm: HTMLElement = this.domElm(id);
            if (elm) {
                /* This is a fix to a focus bug using the 'safest' way to do this without any redesign.
                 If the current focus is on an 'editor' then don't let this logic focus AWAY
                 from the editor. That breaks user input/keyboard. */
                if (S.quanta.currentFocusId?.startsWith(C.ID_PREFIX_EDIT) && document.getElementById(S.quanta.currentFocusId)) {
                    // console.log("Ignoring call to focus away from editor while editing.");
                    return;
                }
                // console.log(`Element found (${id}), focusing`);
                elm.focus();
            }
        }, 750);
    }

    /* Takes textarea dom Id (# optional) and returns its value */
    getTextAreaValById = (id: string): string => {
        const de: HTMLInputElement = <HTMLInputElement>this.domElm(id);
        return de.value;
    }

    setInnerHTMLById = (id: string, val: string) => {
        this.getElm(id, (elm: HTMLElement) => {
            this.setInnerHTML(elm, val);
        });
    }

    setInnerHTML = (elm: HTMLElement, val: string) => {
        if (elm) {
            elm.innerHTML = val;
        }
    }

    domElmObjCss = (elm: HTMLElement, prop: string, val: string) => {
        if (elm) {
            elm.style[prop] = val;
        }
    }

    // This may fail. oddly the API where i get the object from here wants to reutrn Elements not HTMLElements.
    domElmObjRemove = (elm: Element) => {
        if (elm) {
            elm.parentNode.removeChild(elm);
        }
    }

    domElmRemove = (id: string) => {
        const elm = this.domElm(id);
        if (elm) {
            elm.parentNode.removeChild(elm);
        }
    }

    /* We return a promise that resolves to the element, but also support a callback function
    that can be used optionally whenver that's more convenient */
    getElm = (id: string, exResolve: (elm: HTMLElement) => void = null): Promise<HTMLElement> => {
        // Promise is used here instead of async/await because of the resolve being done inside the timer.
        return new Promise<HTMLElement>((resolve, reject) => {

            // First we immediately try to get the element.
            const e: HTMLElement = document.getElementById(id);
            if (e) {
                // console.log("ELM found immediately: "+id);
                if (exResolve) {
                    exResolve(e);
                }
                resolve(e);
            }
            // If element not found we just go into a wait for it (polling)
            // (is there a better native JS approach than polling for the element?)
            else {
                let accumWaitTime = 0;
                const timeSlice = 100;

                // don't hang the promise more than 5 seconds, before reporting error and continuing.
                const maxWaitTime = 5000;

                const interval = setInterval(() => {
                    // oops I only want this on PROD because when debugging it can timeout too much when breakpoints are set.
                    accumWaitTime += timeSlice;
                    if (accumWaitTime >= maxWaitTime) {
                        console.error("waited for but never found element: " + id);
                        clearInterval(interval);
                        resolve(null);
                    }

                    const e: HTMLElement = document.getElementById(id);
                    // console.log("waiting for elm: "+id);
                    if (e) {
                        clearInterval(interval);
                        // console.log("Got Elm: "+id);
                        if (exResolve) {
                            exResolve(e);
                        }
                        resolve(e);
                    }
                }, timeSlice);
            }
        });
    }

    /*
    * Gets the RAW DOM element and displays an error message if it's not found. Do not prefix with "#"
    */
    domElm = (id: string): HTMLElement => {
        if (!id) return null;
        if (id.startsWith("#")) {
            console.log("domElm removed obsolete preceding # from ID " + id);
            id = id.substring(1);
        }

        if (id.includes("#")) {
            console.log("Invalid # in domElm");
            return null;
        }

        return document.getElementById(id);
    }

    forEachElmBySel = (sel: string, callback: Function) => {
        const elements = document.querySelectorAll(sel);
        Array.prototype.forEach.call(elements, callback);
    }

    /* this supposedly came from mustache codebase. */
    escapeHtml = (str: string): string => {
        if (!str) return str;
        return String(str).replace(/[&<>"'`=\/]/g, DomUtil.escapeMapFunc);
    }

    // we have this as a separate static function just to avoid the overhead of creating a new function for every call
    // where this is used.
    static escapeMapFunc(s: any) {
        return DomUtil.escapeMap[s];
    }

    resetDropHandler = (attribs: any) => {
        delete attribs.onDragEnter;
        delete attribs.onDragOver;
        delete attribs.onDragLeave;
        delete attribs.onDrop;
    }

    // https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_ondragenter
    setDropHandler = (attribs: any, fullOutline: boolean, func: (elm: any) => void) => {
        attribs.onDragEnter = function (event: any) {
            event.stopPropagation();
            event.preventDefault();
        };

        attribs.onDragOver = function (event: any) {
            event.stopPropagation();
            event.preventDefault();
            // console.log("onDragOver: id=" + event.target.id);
            event.dataTransfer.dropEffect = "copy"; // See the section on the DataTransfer object.
            if (fullOutline) {
                event.currentTarget.style.border = "2px solid green";
            }
            else {
                event.currentTarget.style.borderTop = "2px solid green";
            }
        };

        attribs.onDragLeave = function (event: any) {
            event.stopPropagation();
            event.preventDefault();
            if (fullOutline) {
                event.currentTarget.style.border = "2px solid transparent";
            }
            else {
                event.currentTarget.style.borderTop = "2px solid transparent";
            }
        };

        attribs.onDrop = function (event: any) {
            // console.log("onDrop: id="+event.target.id);
            event.stopPropagation();
            event.preventDefault();
            if (fullOutline) {
                event.currentTarget.style.border = "2px solid transparent";
            }
            else {
                event.currentTarget.style.borderTop = "2px solid transparent";
            }
            func(event);
        };
    }

    enableMouseEffect = async () => {
        const mouseEffect = await S.localDB.getVal(C.LOCALDB_MOUSE_EFFECT, "allUsers");
        this.mouseEffect = mouseEffect === "1";
        this.mouseEffectDirty = true;
        this.mouseCircle = document.getElementById("mouse-circle");
        document.onmousemove = this.mouseMoved;
    }

    mouseMoved = (e: any) => {
        if (this.mouseEffect) {
            if (this.mouseEffectDirty) {
                this.mouseCircle.style.display = "block";
            }
            this.mouseCircle.style.top = e.pageY + "px";
            this.mouseCircle.style.left = e.pageX + "px";
        }
        else {
            if (this.mouseEffectDirty) {
                this.mouseCircle.style.display = "none";
            }
        }
    };

    /* #mouseEffects (do not delete tag) */
    toggleMouseEffect = () => {
        dispatch("ToggleMouseEffect", s => {
            this.mouseEffect = !this.mouseEffect;
            this.mouseEffectDirty = true;
            S.localDB.setVal(C.LOCALDB_MOUSE_EFFECT, this.mouseEffect ? "1" : "0", "allUsers");
            return s;
        });
    }

    /*
    The other part of this is contained in click-effects.scss
    */
    initClickEffect = () => {
        const clickEffect = (e: MouseEvent) => {
            // use a timeout so we can call 'getState()' without a react error.
            setTimeout(() => {
                /* looks like for some events there's not a good mouse position (happened on clicks to drop down cobo boxes),
                 and is apparently 0, 0, so we just check the sanity of the coordinates here */
                if (!this.mouseEffect || (e.clientX < 10 && e.clientY < 10)) return;
                this.runClickAnimation(e.clientX, e.clientY);
            }, 10);
        };
        document.addEventListener("click", clickEffect);
    }

    runClickAnimation = (x: number, y: number) => {
        const d = document.createElement("div");
        d.className = "clickEffect";

        /* todo-2: make this 5 and 12 offset user configurable. I'm using a custom moust pointer that draws a yellow
        circle around my mouse for use with this effect, to record screencast videos, and that icon circle is not centered
        around the actual mouse click arrow tip location, so we have to use an offset here (only when that Linux OS mouse theme is used)
        to get our expanding circle in CSS to be perfectly centered with the one in the mouse theme, becasue an off center look
        is terrible but the 5 and 12 makes it perfect */
        d.style.left = `${x - 2}px`;
        d.style.top = `${y - 2}px`;
        document.body.appendChild(d);

        setTimeout(() => {
            d.parentElement.removeChild(d);
        }, 300); // this val is in 3 places. put the TS two in a constants file.
    }

    addAnnotation = () => {
        let arrowOption = window.prompt("Annotation Location: tl,tr,bl,br");
        if (!arrowOption) {
            arrowOption = "tl";
        }

        const text = window.prompt("Annotation Text:");
        if (!text) {
            return;
        }

        const d = document.createElement("div");

        const a = document.createElement("div");
        a.className = "arrow-up";
        a.style.left = `${this.mouseX + 15}px`;
        a.style.top = `${this.mouseY - 10}px`;
        document.body.appendChild(a);

        const h = document.createElement("h4");
        h.className = "annotationText";
        const c: any = document.createTextNode(text);
        c.className = "annotationText";
        h.appendChild(c);
        d.appendChild(h);

        d.className = "annotationBox";
        d.style.left = `${this.mouseX}px`;
        d.style.top = `${this.mouseY}px`;
        d.setAttribute("arrowOption", arrowOption);
        this.annotations.push(d);
        this.annotations.push(a);
        document.body.appendChild(d);
        this.dragElement(d, a);
    }

    removeAnnotation = () => {
        if (this.annotations.length > 0) {
            const a = this.annotations.pop();
            a.parentElement.removeChild(a);

            const e = this.annotations.pop();
            e.parentElement.removeChild(e);
        }
    }

    // from here: https://www.w3schools.com/howto/howto_js_draggable.asp
    dragElement(elmnt: any, arrow: any) {
        let pos1 = 0;
        let pos2 = 0;
        let pos3 = 0;
        let pos4 = 0;

        // DO NOT DELETE
        // This code can be used in the future for moving something using a dialog header for example
        // if (document.getElementById(elmnt.id + "header")) {
        //     /* if present, the header is where you move the DIV from: */
        //     document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
        // } else {
        //     /* otherwise, move the DIV from anywhere inside the DIV: */
        //     elmnt.onmousedown = dragMouseDown;
        // }
        elmnt.onmousedown = dragMouseDown;

        function dragMouseDown(e: any) {
            e = e || window.event;
            e.preventDefault();

            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;

            document.onmousemove = elementDrag;
            elmnt.style.cursor = "move";
        }

        function elementDrag(e: any) {
            e = e || window.event;
            e.preventDefault();

            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            const targX = elmnt.offsetLeft - pos1;
            const targY = elmnt.offsetTop - pos2;

            elmnt.style.left = targX + "px";
            elmnt.style.top = targY + "px";

            if (arrow) {
                switch (elmnt.getAttribute("arrowOption")) {
                    case "tl":
                        arrow.style.left = (targX + 15) + "px";
                        arrow.style.top = (targY - 10) + "px";
                        break;
                    case "tr":
                        arrow.style.left = (targX + elmnt.clientWidth - 30) + "px";
                        arrow.style.top = (targY - 10) + "px";
                        break;
                    case "bl":
                        arrow.style.left = (targX + 15) + "px";
                        arrow.style.top = (targY + elmnt.clientHeight - 1) + "px";
                        arrow.className = "arrow-down";
                        break;
                    case "br":
                        arrow.style.left = (targX + elmnt.clientWidth - 30) + "px";
                        arrow.style.top = (targY + elmnt.clientHeight - 1) + "px";
                        arrow.className = "arrow-down";
                        break;
                    default: break;
                }
            }
        }

        function closeDragElement() {
            /* stop moving when mouse button is released: */
            document.onmouseup = null;
            document.onmousemove = null;
            elmnt.style.cursor = "default";
        }
    }
}
