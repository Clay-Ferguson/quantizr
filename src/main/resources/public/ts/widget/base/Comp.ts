// https://reactjs.org/docs/react-api.html
// https://reactjs.org/docs/hooks-reference.html#usestate

import { CompIntf, ReactRenderFunc } from "./CompIntf";
import { PubSub } from "../../PubSub";
import { Constants } from "../../Constants";
import { Singletons } from "../../Singletons";
import * as ReactDOM from "react-dom";
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { ReactNode, ReactElement, useState } from "react";

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
    public initialState: any;

    //Flag that indicates if hookState has been called, and we also use it to know if initialState is no longer in use but state is instead.
    public stateHooked: boolean = false;

    static idToCompMap: { [key: string]: Comp } = {};
    attribs: any;

    /* Note: NULL elements are allowed in this array and simply don't render anything, and are required to be tolerated and ignored */
    children: CompIntf[];

    logEnablementLogic: boolean = false;

    /* These are primarily used by Buttons and MenuItems based on enablement updater */
    private enabled: boolean = true;
    private visible: boolean = true;

    isEnabledFunc: Function;
    isVisibleFunc: Function;
    subscribedToRefresh: boolean;

    extraEnabledClass: string;
    extraDisabledClass: string;

    setStateFunc: Function;

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

        //This map allows us to lookup the Comp directly by its ID similar to a DOM lookup
        Comp.idToCompMap[id] = this;

        //supposedly this pattern works but I'm not sure it's better than what I'm doing.
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

    subscribeToRefresh = () => {
        if (this.subscribedToRefresh) {
            return;
        }
        this.subscribedToRefresh = true;

        PubSub.sub(Constants.PUBSUB_RefreshEnablement, (unused: Object) => {
            this.whenElm((elm: HTMLElement) => {
                if (this.logEnablementLogic) {
                    //console.log("PubSub driven refreshState: on ID=" + this.getId());
                }
                this.refreshState();
            });
        });
    }

    /* Function refreshes all enablement and visibility based on current state of app 
    
    Now that we have true ReactHook for setState, all pre-existing state management of menus needs to be updated to 
    use that new way (todo-1)
    */
    refreshState(): void {
        //todo-1: future optimization. For components that don't implement any enablement/visibilty functions, we can
        //just only do this enablement stuff ONCE and then not do it again on the same element.
        this.updateState();
        this.setVisible(this.visible);
        this.setEnabled(this.enabled);
        //console.log("refreshState: id=" + this.getId() + " enabled=" + this.enabled);
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
        this.subscribeToRefresh();
    }

    setIsVisibleFunc = (isVisibleFunc: Function) => {
        if (!isVisibleFunc) return;
        this.isVisibleFunc = isVisibleFunc;
        this.subscribeToRefresh();
    }

    updateState = (): boolean => {
        let ret = false;

        if (this.isEnabledFunc) {
            this.setEnabled(this.isEnabledFunc());
            //console.log("in updateState: id=" + this.getId() + " enablement function said: " + this.enabled);
            ret = true;
        }
        else {
            //console.log("in updateState: id=" + this.getId() + " has no ENABLEMENT function");
        }

        if (this.isVisibleFunc) {
            this.visible = this.isVisibleFunc();
            ret = true;
        }
        return ret;
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

    whenElm = (func: (elm: HTMLElement) => void) => {
        S.util.getElm(this.getId(), func);
    }

    /* WARNING: this is NOT a setter for 'this.visible'. Perhaps i need to rename it for better clarity, it takes
    this.visible as its input sometimes. Slightly confusing */
    setVisible = (visible: boolean) => {
        this.whenElm((elm: HTMLElement) => {
            S.util.setElmDisplay(elm, visible);
        });
    }

    /* WARNING: this is NOT the setter for 'this.enabled' */
    setEnabled = (enabled: boolean) => {
        this.enabled = enabled;
        this.whenElm((elm: HTMLElement) => {
            (<any>elm).disabled = !enabled;

            if (!enabled) {
                elm.setAttribute("disabled", "disabled");
            }
            else {
                elm.removeAttribute("disabled");
            }

            //IF NOT ENABLED
            if (!enabled) {
                S.util.addClassToElm(elm, "disabled");

                if (this.extraDisabledClass) {
                    S.util.addClassToElm(elm, this.extraDisabledClass);
                }
                if (this.extraEnabledClass) {
                    S.util.removeClassFromElm(elm, this.extraEnabledClass);
                }
            }
            //IF ENBALED
            else {
                S.util.removeClassFromElm(elm, "disabled");
                if (this.extraEnabledClass) {
                    S.util.addClassToElm(elm, this.extraEnabledClass);
                }
                else {
                    if (this.logEnablementLogic) {
                        console.log("No extraEnabledClass on id: " + this.getId());
                    }
                }

                if (this.extraDisabledClass) {
                    S.util.removeClassFromElm(elm, this.extraDisabledClass);
                }
                else {
                    if (this.logEnablementLogic) {
                        console.log("No extraDisabledClass on id: " + this.getId());
                    }
                }
            }
            //console.log("class proof[enabled="+enabled+"]: id="+this.getId()+" class=" + document.getElementById(this.getId()).className);
        });
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

    /* Attaches a react element directly to the dom at the DOM id specified. Throws exception of not a react element. */
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
                reChildren.push(child.render());
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

    /* Haven't tested this variation but it will add (merge in) new state into existing state without
     overwiting existing state */
    mergeState = (newState: any) => {
        this.setState(prevState => {
            // Object.assign would also work
            return { ...prevState, ...newState };
        });
    }

    hookState = (newState: any) => {
        const [state, setStateFunc] = useState(newState);
        this.setStateFunc = setStateFunc;
        this.state = state;
        this.stateHooked = true;
        this.initialState = null;
    }

    /* Note: this method performs a direct state mod, but for react comps it gets overridden using useState return value 
    
    To add new properties...use this pattern (mergeState above does this)
    setState(prevState => {
        // Object.assign would also work
        return {...prevState, ...updatedValues};
    });
    */
    setState = (state: any) => {
        // If 'hookState' has been called then this function should be pointing to whatever was returned from 'useState' 
        if (this.stateHooked) {
            //throw new Error("setState called when stateHooked is set. This is an invalid, and indicates a bug.");
            this.state = state;
            this.setStateFunc(state);
        }
        else {
            // If state not yet hooked, we keep the 'state' in initialState
            this.initialState = state;
        }
    }

    getState = (): any => {
        return this.stateHooked ? this.state : this.initialState;
    }

    // Core 'render' function used by react. Never really any need to override this, but it's theoretically possible.
    render = (): ReactNode => {
        this.hookState(this.initialState || this.state || {});
        return this.compRender();
    }

    // This is the function you override/define to implement the actual render method, which is simple and decoupled from state
    // manageent aspects that are wrapped in 'render' which is what calls this, and the ONLY function that calls this.
    compRender = (): ReactNode => {
        if (true) {
            throw new Error("compRender should be overridden by the derived class.");
        }
    }
}
