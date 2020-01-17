// https://reactjs.org/docs/react-api.html
// https://reactjs.org/docs/hooks-reference.html#usestate

import { CompIntf, ReactRenderFunc } from "./CompIntf";
import { PubSub } from "../../PubSub";
import { Constants } from "../../Constants";
import { Singletons } from "../../Singletons";
import * as ReactDOM from "react-dom";
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { ReactNode, ReactElement, useState, useEffect } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var PROFILE;

/**
 * This base class is a hybrid that can render React components or can be used to render plain HTML to be used in innerHTML of elements.
 * The innerHTML approach is being phased out in order to transition fully over to normal ReactJS. 
 */
export abstract class Comp implements CompIntf {

    public debug: boolean = false;
    private static guid: number = 0;

    //This must private so that getState us used instead which might return 'state' but it also might return 'initialState'
    private state: any;

    //This is the state that is in effect up until the first 'render' call, which is when hookState first gets called, and
    //the setState becomes the function returned from react useState, and the whole React-controlled rendering goes into effect.
    public initialState: any = { visible: true, enabled: true };

    static idToCompMap: { [key: string]: Comp } = {};
    attribs: any;

    /* Note: NULL elements are allowed in this array and simply don't render anything, and are required to be tolerated and ignored */
    children: CompIntf[];

    logEnablementLogic: boolean = true;

    isEnabledFunc: Function;
    isVisibleFunc: Function;

    jsClassName: string;

    setStateFunc: Function;

    //holds queue of functions to be ran once this component is rendered.
    domAddFuncs: ((elm: HTMLElement) => void)[];

    //keeps track of knowledge that the element already got rendered so any whenElm
    //functions will run immediately rather than wait for the lifecycle even which will never happen again?
    //I'm actually not sure if lifecycle runs again when setStat is called, but using this state variable should
    //nonetheless be correct.
    domAddEventRan: boolean;

    /**
     * 'react' should be true only if this component and all its decendants are true React components that are rendered and
     * controlled by ReactJS (rather than our own innerHTML)
     * 
     * allowRect can be set to false for components that are known to be used in cases where not all of their subchildren are react or for
     * whatever reason we want to disable react rendering, and fall back on render-to-text approach
     */
    constructor(attribs: any) {
        this.attribs = attribs || {};
        this.children = [];

        /* If an ID was specifically provided, then use it, or else generate one */
        let id = this.attribs.id || ("c" + Comp.nextGuid());
        this.attribs.id = id;
        this.attribs.key = id;

        this.jsClassName = this.constructor.name + "[" + id + "]";
        //console.log("jsClassName: " + this.jsClassName);

        //This map allows us to lookup the Comp directly by its ID similar to a DOM lookup
        Comp.idToCompMap[id] = this;

        //supposedly this pattern works but I'm not sure it's better than what I'm doing, unless this allows an ability
        //to call super.method() which I'm not sure my current architecture can support super calls to functions that are overridden
        //in base classes
        this.bindExampleFunction = this.bindExampleFunction.bind(this);
    }

    bindExampleFunction() {
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


    /* Function refreshes all enablement and visibility based on current state of app */
    refreshState(): void {
        let enabled = this.isEnabledFunc ? this.isEnabledFunc() : true;
        let visible = this.isVisibleFunc ? this.isVisibleFunc() : true;

        //console.log("refreshState. " + this.jsClassName + " visible=" + visible + " enabled=" + enabled);

        this.mergeState({
            enabled,
            visible
        });

        //recursively set all children states
        if (this.children && this.children.length > 0) {
            this.children.forEach((child: Comp) => {
                if (child) {
                    child.refreshState();
                }
            });
        }
    }

    setDomAttr = (attrName: string, attrVal: string) => {
        this.whenElm((elm: HTMLElement) => {
            elm.setAttribute(attrName, attrVal);
            this.attribs[attrName] = attrVal;
        });
    }

    setIsEnabledFunc = (isEnabledFunc: Function) => {
        if (!isEnabledFunc) return;
        this.isEnabledFunc = isEnabledFunc;
        this.mergeState({ enabled: isEnabledFunc() });
    }

    setIsVisibleFunc = (isVisibleFunc: Function) => {
        if (!isVisibleFunc) return;
        this.isVisibleFunc = isVisibleFunc;
        this.mergeState({ visible: isVisibleFunc() });
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

    whenElm = (func: (elm: HTMLElement) => void) => {
        if (this.domAddEventRan) {
            //console.log("ran whenElm event immediately. domAddEvent had already ran");
            func(this.getElement());
            return;
        }

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

    /**
     * Elements can ignore this if they never call renderElement, but it's required to implement this to support renderElement
     */
    getTag = (): string => {
        throw "getTag() was not overridden";
    }

    getAttribs = (): Object => {
        return this.attribs;
    }

    //=====================================================================
    // ALL REACT functions should go below this divider
    //=====================================================================

    renderHtmlElm = (elm: ReactElement): string => {
        return renderToString(elm);
        //return renderToStaticMarkup(elm);
    }

    reactRenderHtmlInDiv = (): string => {
        this.reactRenderToDOM(this.getId() + "_re");
        return "<div id='" + this.getId() + "_re'></div>";
    }

    reactRenderHtmlInSpan = (): string => {
        this.reactRenderToDOM(this.getId() + "_re");
        return "<span id='" + this.getId() + "_re'></span>";
    }

    /* Attaches a react element directly to the dom at the DOM id specified. Throws exception of not a react element. 
    
    todo-0: this needs to be really removed if at all possible.
    */
    reactRenderToDOM = (id: string = null) => {
        if (!id) {
            id = this.getId();
        }
        // if (!this.render) {
        //     throw new Error("Attempted to treat non-react component as react: " + this.constructor.name);
        // }
        S.util.getElm(id, (elm: HTMLElement) => {
            ReactDOM.render(S.e(this.render, this.attribs), elm);
        });
    }

    makeReactChildren = (): ReactNode[] => {
        if (this.children == null || this.children.length == 0) return null;
        let reChildren: ReactNode[] = [];

        this.children.forEach((child: Comp) => {
            if (child) {
                let reChild: ReactNode = null;
                try {
                    reChild = child.render();
                }
                catch (e) {
                    console.error("Failed to render child " + child.jsClassName + " attribs.key=" + child.attribs.key);
                }
                if (reChild) {
                    reChildren.push(reChild);
                }
            }
        });
        return reChildren;
    }

    /* Renders this node to a specific tag, including support for non-React children anywhere in the subgraph */
    tagRender = (tag: string, content: string, props: any) => {
        let children: any[] = this.makeReactChildren();
        if (children) {
            if (content) {
                children.unshift(content);
            }
        }
        else {
            children = [content];
        }
        return S.e(tag, props, children);
    }

    hookState = (newState: any) => {
        const [state, setStateFunc] = useState(newState);
        this.setStateFunc = setStateFunc;
        this.state = state;
        this.initialState = null;
    }

    /* This is how you can add properties and overwrite them in existing state. Since all components are assumed to have
    both visible/enbled properties, this is the safest way to set other state that leaves visible/enabled props intact */
    mergeState = (state: any): any => {
        //If we still have an initial state then it's the 'active' state we need to merge into
        if (this.initialState) {
            this.initialState = { ...this.initialState, ...state };
        }
        //otherwise the actual 'state' itself is currently the active state to merge into.
        else {
            this.state = { ...this.state, ...state };
            this.setStateFunc(this.state);
        }
    }

    /* Note: this method performs a direct state mod, but for react comps it gets overridden using useState return value 
    
    To add new properties...use this pattern (mergeState above does this)
    setStateFunc(prevState => {
        // Object.assign would also work
        return {...prevState, ...updatedValues};
    });
    */
    setState = (state: any) => {
        // If 'hookState' has been called then this function should be pointing to whatever was returned from 'useState' 
        if (!this.initialState) {
            //throw new Error("setState called when stateHooked is set. This is an invalid, and indicates a bug.");
            this.state = state;
            this.setStateFunc(this.state);
        }
        else {
            // If state not yet hooked, we keep the 'state' in initialState
            this.initialState = state;
        }
    }

    getState = (): any => {
        return this.state || this.initialState;
    }

    // Core 'render' function used by react. Never really any need to override this, but it's theoretically possible.
    render = (): ReactNode => {
        let ret: ReactNode = null;
        try {
            this.hookState(this.initialState || this.state || {});

            useEffect(this.domAddEvent, []);

            // These two other effect hooks should work fine but just aren't needed yet.
            // useEffect(() => {
            //     console.log("$$$$ DOM UPDATE: " + this.jsClassName);
            // });

            // todo-0: this never ran (for popup menu) and my best guess is that dialogs are
            // being hidden, but not 'detatched' when closed, bc that menu runs inside a dialog container.
            // (update: actually this didn't run b/c dialog is done using pure DOM Javascript, which is the same reason
            // whenElmEx has to still exist right now)
            // useEffect(() => {
            //     return () => {
            //         console.log("$$$$ DOM REMOVE:" + this.jsClassName);
            //     }
            // }, []);

            ret = this.compRender();
        }
        catch (e) {
            console.error("Failed to render child (in render method)" + this.jsClassName + " attribs.key=" + this.attribs.key);
        }
        return ret;
    }

    domAddEvent = (): void => {
        this.domAddEventRan = true;

        if (this.domAddFuncs) {
            let elm: HTMLElement = this.getElement();
            if (!elm) {
                console.error("elm not found in domAddEvent: " + this.jsClassName);
                return;
            }
            else {
                // console.log("domAddFuncs running for "+this.jsClassName+" for "+this.domAddFuncs.length+" functions.");
            }
            this.domAddFuncs.forEach((func) => {
                func(elm);
            });
            this.domAddFuncs = null;
        }
    }

    // This is the function you override/define to implement the actual render method, which is simple and decoupled from state
    // manageent aspects that are wrapped in 'render' which is what calls this, and the ONLY function that calls this.
    compRender = (): ReactNode => {
        if (true) {
            throw new Error("compRender should be overridden by the derived class.");
        }
    }
}
