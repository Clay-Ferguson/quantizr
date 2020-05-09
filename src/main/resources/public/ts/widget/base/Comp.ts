// https://reactjs.org/docs/react-api.html
// https://reactjs.org/docs/hooks-reference.html#usestate
// #RulesOfHooks: https://fb.me/rules-of-hooks

import { CompIntf } from "./CompIntf";
import { PubSub } from "../../PubSub";
import { Constants as C } from "../../Constants";
import { Singletons } from "../../Singletons";
import * as ReactDOM from "react-dom";
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { ReactNode, ReactElement, useState, useEffect, useLayoutEffect } from "react";
import { Provider } from 'react-redux';

//tip: merging states: this.state = { ...this.state, ...moreState };

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var PROFILE;

/**
 * This base class is a hybrid that can render React components or can be used to render plain HTML to be used in innerHTML of elements.
 * The innerHTML approach is being phased out in order to transition fully over to normal ReactJS. 
 */
export abstract class Comp implements CompIntf {

    public rendered: boolean = false;
    public debug: boolean = false;
    private static guid: number = 0;

    //todo-1: make this private?
    public state: any = {};

    static idToCompMap: { [key: string]: Comp } = {};
    attribs: any;

    /* Note: NULL elements are allowed in this array and simply don't render anything, and are required to be tolerated and ignored */
    children: CompIntf[];

    logEnablementLogic: boolean = true;

    isEnabledFunc: Function;
    isVisibleFunc: Function;

    jsClassName: string;
    clazz: string;

    //holds queue of functions to be ran once this component is rendered.
    domAddFuncs: ((elm: HTMLElement) => void)[];

    //keeps track of knowledge that the element already got rendered so any whenElm
    //functions will run immediately rather than wait for the lifecycle even which will never happen again?
    //I'm actually not sure if lifecycle runs again when setStat is called, but using this state variable should
    //nonetheless be correct.
    domAddEventRan: boolean;

    renderRawHtml: boolean = false;

    /* Used to restore the border style after a drag event ends */
    nonDragBorder: string = null;

    /**
     * 'react' should be true only if this component and all its decendants are true React components that are rendered and
     * controlled by ReactJS (rather than our own innerHTML)
     * 
     * allowRect can be set to false for components that are known to be used in cases where not all of their subchildren are react or for
     * whatever reason we want to disable react rendering, and fall back on render-to-text approach
     */
    constructor(attribs?: any) {
        this.attribs = attribs || {};
        this.children = [];

        /* If an ID was specifically provided, then use it, or else generate one */
        let id = this.attribs.id || ("c" + Comp.nextGuid());
        this.clazz = this.constructor.name;
        this.setId(id);
    }

    setId = (id: string) => {
        this.attribs.id = id;
        this.attribs.key = id;
        this.jsClassName = this.constructor.name + "[" + id + "]";
        Comp.idToCompMap[id] = this;
    }

    childrenExist = (): boolean => {
        if (this.children == null || this.children.length == 0) return false;
        let ret = false;
        this.children.forEach((child: Comp) => {
            if (child) {
                ret = true;
            }
        });
        return ret;
    }

    setDomAttr = (attrName: string, attrVal: string) => {
        this.whenElm((elm: HTMLElement) => {
            elm.setAttribute(attrName, attrVal);
            this.attribs[attrName] = attrVal;
        });
    }

    setIsEnabledFunc = (isEnabledFunc: Function) => {
        this.isEnabledFunc = isEnabledFunc;
    }

    setIsVisibleFunc = (isVisibleFunc: Function) => {
        this.isVisibleFunc = isVisibleFunc;
    }

    static nextGuid(): number {
        return ++Comp.guid;
    }

    static findById(id: string): Comp {
        return Comp.idToCompMap[id];
    }

    removeAllChildren = (): void => {
        this.children = [];
    }

    getId = (): string => {
        return this.attribs.id;
    }

    /* Warning: Under lots of circumstances it's better to call util.getElm rather than getElement() because getElement returns
    null unless the element is already created and rendered onto the DOM */
    getElement = (): HTMLElement => {
        return <HTMLElement>document.getElementById(this.getId());
    }

    //This is the original implementation of whenElm which uses a timer to wait for the element to come into existence
    //and is only used in one odd place where we manually attach Dialogs to the DOM (see DialogBase.ts)
    whenElmEx = (func: (elm: HTMLElement) => void) => {
        S.util.getElm(this.getId(), func);
    }

    //WARNING: Use whenElmEx for DialogBase derived components!
    whenElm = (func: (elm: HTMLElement) => void) => {
        //console.log("whenElm running for " + this.jsClassName);
        if (this.domAddEventRan) {
            func(this.getElement());
            return;
        }

        let elm = this.getElement();
        if (elm) {
            //console.log("Looked for and FOUND on DOM: " + this.jsClassName);
            func(elm);
            return;
        }

        //console.log("queueing the function " + this.jsClassName);
        //queue up the 'func' to be called once the domAddEvent gets executed.
        if (!this.domAddFuncs) {
            this.domAddFuncs = [func];
        }
        else {
            this.domAddFuncs.push(func);
        }
    }

    /* WARNING: this is NOT a setter for 'this.visible'. Perhaps i need to rename it for better clarity, it takes
    this.visible as its input sometimes. Slightly confusing */
    setVisible = (visible: boolean) => {
        this.mergeState({ visible });
    }

    /* WARNING: this is NOT the setter for 'this.enabled' */
    setEnabled = (enabled: boolean) => {
        this.mergeState({ enabled });
    }

    setClass = (clazz: string): void => {
        this.attribs.className = clazz;
    }

    setOnClick = (onClick: Function): void => {
        this.attribs.onClick = () => {
            if (!this.isEnabledFunc || this.isEnabledFunc()) {
                onClick();
            }
        };
    }

    setInnerHTML = (html: string) => {
        this.whenElm((elm: HTMLElement) => {
            elm.innerHTML = html;
        });
    }

    addChild = (comp: Comp): void => {
        if (!comp) return;
        this.children.push(comp);
    }

    addChildren = (comps: Comp[]): void => {
        this.children.push.apply(this.children, comps);
    }

    setChildren = (comps: CompIntf[]) => {
        this.children = comps || [];
    }

    getAttribs = (): Object => {
        return this.attribs;
    }

    renderHtmlElm = (elm: ReactElement): string => {
        return renderToString(elm);
        //return renderToStaticMarkup(elm);
    }

    reactRenderHtmlInDiv = (): string => {
        this.updateDOM(null, this.getId() + "_re");
        return "<div id='" + this.getId() + "_re'></div>";
    }

    reactRenderHtmlInSpan = (): string => {
        this.updateDOM(null, this.getId() + "_re");
        return "<span id='" + this.getId() + "_re'></span>";
    }

    /* Attaches a react element directly to the dom at the DOM id specified. 
       WARNING: This can only re-render the *children* under the target node and not the attributes or tag of the node itself. 
       
       Also this can only re-render TOP LEVEL elements, meaning elements that are not children of other React Elements, but attached
       to the DOM old-school.
    */
    updateDOM = (store: any = null, id: string = null) => {
        if (!id) {
            id = this.getId();
        }
        // if (!this.render) {
        //     throw new Error("Attempted to treat non-react component as react: " + this.constructor.name);
        // }
        S.util.getElm(id, (elm: HTMLElement) => {
            //See #RulesOfHooks in this file, for the reason we blowaway the existing element to force a rebuild.
            ReactDOM.unmountComponentAtNode(elm);

            let reactElm = S.e(this.render, this.attribs);

            /* If this component has a store then wrap with the Redux Provider to make it all reactive */
            if (store) {
                //console.log("Rendering with provider");
                let provider = S.e(Provider, { store }, reactElm);
                ReactDOM.render(provider, elm);
            }
            else {
                ReactDOM.render(reactElm, elm);
            }
        });
    }

    buildChildren = (): ReactNode[] => {
        //console.log("buildChildren: " + this.jsClassName);
        if (this.children == null || this.children.length == 0) return null;
        let reChildren: ReactNode[] = [];

        this.children.forEach((child: Comp) => {
            if (child) {
                let reChild: ReactNode = null;
                try {
                    //console.log("ChildRender: " + child.jsClassName);
                    reChild = S.e(child.render, child.attribs);
                }
                catch (e) {
                    console.error("Failed to render child " + child.jsClassName + " attribs.key=" + child.attribs.key);
                }

                if (reChild) {
                    reChildren.push(reChild);
                }
                else {
                    //console.log("ChildRendered to null: " + child.jsClassName);
                }
            }
        });
        return reChildren;
    }

    focus = (): void => {
        S.util.delayedFocus(this.getId());
    }

    /* Renders this node to a specific tag, including support for non-React children anywhere in the subgraph */
    tagRender = (tag: string, content: string, props: any) => {
        //console.log("Comp.tagRender: " + this.jsClassName + " id=" + props.id);

        this.state.enabled = this.isEnabledFunc ? this.isEnabledFunc() : true;
        this.state.visible = this.isVisibleFunc ? this.isVisibleFunc() : true;

        try {
            let children: any[] = this.buildChildren();
            if (children) {
                if (content) {
                    children.unshift(content);
                }
            }
            else {
                children = content ? [content] : null;
            }

            if (children && children.length > 0) {
                //console.log("Render Tag with children.");
                return S.e(tag, props, children);
            }
            else {
                //console.log("Render Tag no children.");
                return S.e(tag, props);
            }
        }
        catch (e) {
            console.error("Failed in Comp.tagRender" + this.jsClassName + " attribs=" + S.util.prettyPrint(this.attribs));
        }
    }

    /* This is how you can add properties and overwrite them in existing state. Since all components are assumed to have
   both visible/enbled properties, this is the safest way to set other state that leaves visible/enabled props intact */
    mergeState = (moreState: any): any => {
        this.setState((state: any) => {
            this.state = { ...state, ...moreState };
            return this.state;
        });
    }


    /* Note: this method performs a direct state mod, until react overrides it using useState return value 
    
    To add new properties...use this pattern (mergeState above does this)
    setStateFunc(prevState => {
        // Object.assign would also work
        return {...prevState, ...updatedValues};
    });
    */
    setState = (state: any) => {
        if (!state) {
            state = {};
        }
        //console.log("setState[" + this.jsClassName + "] STATE=" + S.util.prettyPrint(state));
        if (typeof state == "function") {
            this.state = state(this.state);
        }
        else {
            this.state = state;
        }
    }

    getState = (): any => {
        return this.state;
    }

    // Core 'render' function used by react. Never really any need to override this, but it's theoretically possible.
    render = (): ReactNode => {
        //console.log("rendering[" + this.jsClassName + "] STATE=" + S.util.prettyPrint(this.state));
        this.rendered = true;

        let ret: ReactNode = null;
        try {
            const [state, setState] = useState(this.state);
            //console.warn("Component state was null in render for: " + this.jsClassName);
            this.state = state;
            this.setState = setState;

            /* This 'useEffect' call makes react call 'domAddEvent' once the dom element comes into existence on the acutal DOM */
            useEffect(this.domAddEvent, []);

            //This hook should work fine but just isn't needed yet.
            useEffect(() => {
                //console.log("DOM UPDATE: " + this.jsClassName);
                this.domUpdateEvent();
            });

            useLayoutEffect(() => {
                //console.log("DOM PRE-UPDATE: " + this.jsClassName);
                this.domPreUpdateEvent();
            });

            /* 
            This 'useEffect' call makes react call 'domRemoveEvent' once the dom element is removed from the acutal DOM.
            (NOTE: Remember this won't run for DialogBase because it's done using pure DOM Javascript, which is the same reason
            whenElmEx has to still exist right now)
            */
            useEffect(() => {
                return () => {
                    this.domRemoveEvent();
                }
            }, []);

            this.state.enabled = this.isEnabledFunc ? this.isEnabledFunc() : true;
            this.state.visible = this.isVisibleFunc ? this.isVisibleFunc() : true;

            // todo-1: something like this could encapsulate retting display, but currently isn't needed.
            // this.attribs.style = this.attribs.style || {};
            // this.attribs.style.display = this.getState().visible ? "block" : "none";

            this.preRender();
            ret = this.compRender();
        }
        catch (e) {
            //todo-1: this is not logging the stack
            console.error("Failed to render child (in render method)" + this.jsClassName + " attribs.key=" + this.attribs.key + " Error: " + e);
        }
        return ret;
    }

    domRemoveEvent = (): void => {
        //Clean up this map, or else this would just be a memory leak
        delete Comp.idToCompMap[this.getId()];
        //console.log("DOM REMOVE:" + this.jsClassName + " compMapSize=" + S.util.getPropertyCount(Comp.idToCompMap));
    }

    domUpdateEvent = (): void => {
    }

    domPreUpdateEvent = (): void => {
    }

    domAddEvent = (): void => {
        //console.log("domAddEvent: " + this.jsClassName);
        this.domAddEventRan = true;

        if (this.domAddFuncs) {
            let elm: HTMLElement = this.getElement();
            if (!elm) {
                console.error("elm not found in domAddEvent: " + this.jsClassName);
                return;
            }
            else {
                //console.log("domAddFuncs running for "+this.jsClassName+" for "+this.domAddFuncs.length+" functions.");
            }
            this.domAddFuncs.forEach((func) => {
                func(elm);
            });
            this.domAddFuncs = null;
        }
    }

    /* Intended to be optionally overridable to set children */
    public preRender = (): void => {
    }

    // This is the function you override/define to implement the actual render method, which is simple and decoupled from state
    // manageent aspects that are wrapped in 'render' which is what calls this, and the ONLY function that calls this.
    public compRender = (): ReactNode => {
        if (true) {
            throw new Error("compRender should be overridden by the derived class.");
        }
    }

    //https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_ondragenter

    //todo-1: move this out into a utilities class.
    setDropHandler = (func: (elm: any) => void): void => {

        this.whenElm((elm: HTMLElement) => {
            if (!elm) return;

            this.nonDragBorder = elm.style.borderLeft;

            elm.addEventListener("dragenter", (event) => {
                event.preventDefault();
            });

            elm.addEventListener("dragover", (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';  // See the section on the DataTransfer object.

                /* warning: this 9px should match the $fatBorderSize in the scss file */
                elm.style.borderLeft = "9px dotted green";
            });

            elm.addEventListener("dragleave", (event) => {
                event.preventDefault();
                elm.style.borderLeft = this.nonDragBorder;
            });

            elm.addEventListener("drop", (event) => {
                event.stopPropagation();
                event.preventDefault();
                elm.style.borderLeft = this.nonDragBorder;
                func(event);
            });
        });
    }
}
