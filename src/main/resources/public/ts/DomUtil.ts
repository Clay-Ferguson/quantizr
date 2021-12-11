import { Comp } from "./comp/base/Comp";
import { Constants as C } from "./Constants";
import { S } from "./Singletons";

export class DomUtil {
    getPropFromDom = (evt: Event, prop: string): string => {
        let val = null;

        // get the id from this node or any parent node.
        if (evt && evt.target) {
            let target: any = evt.target;
            while (target) {
                // console.log("Checking target.id " + target.id + " for nid");
                val = target.getAttribute(prop);
                if (val) return val;
                target = target.parentElement;
            }
        }

        if (!val) {
            console.log("Unable to get prop " + prop + " from parameter or html element or any parents.");
        }

        return val;
    }

    /* set focus to element by id */
    focusId = (id: string): void => {
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

    setInnerHTMLById = (id: string, val: string): void => {
        this.getElm(id, (elm: HTMLElement) => {
            this.setInnerHTML(elm, val);
        });
    }

    setInnerHTML = (elm: HTMLElement, val: string): void => {
        if (elm) {
            elm.innerHTML = val;
        }
    }

    domElmObjCss = (elm: HTMLElement, prop: string, val: string): void => {
        if (elm) {
            elm.style[prop] = val;
        }
    }

    // This may fail. oddly the API where i get the object from here wants to reutrn Elements not HTMLElements.
    domElmObjRemove = (elm: Element): void => {
        if (elm) {
            elm.parentNode.removeChild(elm);
        }
    }

    domElmRemove = (id: string): void => {
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
            console.log("whenElm removed obsolete preceding # from ID " + id);
            id = id.substring(1);
        }

        if (id.includes("#")) {
            console.log("Invalid # in domElm");
            return null;
        }

        const e: HTMLElement = document.getElementById(id);
        return e;
    }

    forEachElmBySel = (sel: string, callback: Function): void => {
        const elements = document.querySelectorAll(sel);
        Array.prototype.forEach.call(elements, callback);
    }
}
