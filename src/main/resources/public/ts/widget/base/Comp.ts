//https://reactjs.org/docs/react-api.html

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

    /* Mainly invented to support markdown rendering this forces React to render the raw html */
    public renderRawHtml: boolean = false;
    
    public state: any;

    static idToCompMap: { [key: string]: Comp } = {};
    attribs: any;

    /* Note: NULL elements are allowed in this array and simply don't render anything, and are required to be tolerated and ignored */
    children: CompIntf[];

    /* State tells us if the widget is currently about to re-render itself as soon as it can */
    renderPending: boolean = false;

    logEnablementLogic: boolean = false;

    /* These are primarily used by Buttons and MenuItems based on enablement updater */
    private enabled: boolean = true;
    private visible: boolean = true;

    isEnabledFunc: Function;
    isVisibleFunc: Function;
    subscribedToRefresh: boolean;

    extraEnabledClass: string;
    extraDisabledClass: string;

    /**
     * 'react' should be true only if this component and all its decendants are true React components that are rendered and
     * controlled by ReactJS (rather than our own innerHTML)
     * 
     * allowRect can be set to false for components that are known to be used in cases where not all of their subchildren are react or for
     * whatever reason we want to disable react rendering, and fall back on render-to-text approach
     */
    constructor(attribs: any) {
        this.repairProps(attribs);
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

    //Tip: always call this instead of accessing children directly.
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
            this.whenElm((elm) => {
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
        this.whenElm((elm) => {
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

    /* Warning: Under lots of circumstances it's better to call dom.whenElm rather than getElement() because getElement returns
    null unless the element is already created and rendered onto the DOM */
    getElement = (): HTMLElement => {
        return <HTMLElement>document.getElementById(this.getId());
    }

    whenElm = (func: Function) => {
        S.dom.whenElm(this.getId(), func);
    }

    /* WARNING: this is NOT a setter for 'this.visible'. Perhaps i need to rename it for better clarity, it takes
    this.visible as its input sometimes. Slightly confusing */
    setVisible = (visible: boolean) => {
        S.dom.whenElm(this.getId(), (elm: HTMLElement) => {
            S.util.setElmDisplay(elm, visible);
        });
    }

    /* WARNING: this is NOT the setter for 'this.enabled' */
    setEnabled = (enabled: boolean) => {
        this.enabled = enabled;
        S.dom.whenElm(this.getId(), (elm: HTMLElement) => {
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
        S.dom.whenElm(this.getId(), (elm) => {
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

    /* This is a stop-gap measure to ease the convertion of the app to spring, and auto-fix certain nuances of attributes
    that are special in React

    todo-1: will be deleting this function soon, not yet.
    */
    repairProps(p: any) {
        if (PROFILE=="prod") {
            return;
        }
        
        if (p == null) return;

        if (p.style && typeof p.style === 'string') {
            console.error("element id: " + p.id + " has a style specified as string: " + p.style);
            alert("Error. Check browser log."); 
            p.style = { border: '4px solid red' };
            p.title = "ERROR: style specified as string instead of object.";
        }

        if (p.class) {
            p.className = p.class;
            p.style = { border: '4px solid green' };
            delete p.class;
            console.error("class was corrected to className: Value was " + p.class);
            alert("Error. Check browser log."); 
        }

        if (p.for) {
            p.htmlFor = p.for;
            p.style = { border: '4px solid blue' };
            console.error("for was changed to htmlFor");
            delete p.for;
            alert("Error. Check browser log."); 
        }
    }

    /* Attaches a react element directly to the dom at the DOM id specified. Throws exception of not a react element. */
    reactRenderToDOM = (id: string = null) => {
        if (!id) {
            id = this.getId();
        }
        if (!this.render) {
            throw new Error("Attempted to treat non-react component as react: " + this.constructor.name);
        }
        S.dom.whenElm(id, (elm: HTMLElement) => {
            this.repairProps(this.attribs);
            ReactDOM.render(S.e(this.render, this.attribs), elm);
        });
    }

    /* Using the 'children' property this returns an array that's guaranteed to be a react Element, even if
    some of the components are *not* yet converted to react (i.e. their render method being null, and them being components that still
    render to HTML string). Note this is a recursive function and renders all children and their children. */
    makeReactChildren = (): ReactNode[] => {
        if (this.children == null || this.children.length == 0) return null;
        let reChildren: ReactNode[] = [];

        let idx = 0;
        this.children.forEach((child: Comp) => {
            idx++;
            if (child) {

                /* If this is an old-school non-react component (i.e. no render method, then we render it's HTML 'dangerously' and put it into a 
                react span Element, as the inner html. This mess will go away once we are fully converted to ReactJS in this app, at which
                time none of our components will render to HTML string */
                if (!child.render || child.renderRawHtml) {
                    let content = (child.renderRawHtml && (<any>child).content) ? (<any>child).content : "";
                    let p = child.attribs;
                    p.key = this.getId() + "_md" + idx;
                    p.dangerouslySetInnerHTML = { "__html": content };
                    this.repairProps(p);
                    reChildren.push(S.e('div', p));
                    return;
                }

                //React needs to have unique keys
                if (child.attribs.id) {
                    child.attribs.key = child.attribs.id;
                }
                else {
                    if (!child.getId()) {
                        console.log("oops. child.getId() is null!");
                    }
                    child.attribs.key = child.getId();
                }    
                this.repairProps(child.attribs);
                reChildren.push(S.e(child.render, child.attribs, child.makeReactChildren()));
            }
        });
        return reChildren;
    }

    /* Renders this node to a specific tag, including support for non-React children anywhere in the subgraph */
    tagRender = (tag: string, content: string, props: any) => {
        if (this.renderRawHtml) {
            if (this.children) {
                console.log("tagRender on comp with renderRawHtml also has children. This is probably a bug. Children will not be rendered.");
            }

            let p: any = { key: this.getId() + "_rawhtm" };
            p.dangerouslySetInnerHTML = { "__html": content };
            return S.e(tag, p);
        }
        else {
            let children: any[] = this.makeReactChildren();
            if (children) {
                if (content) {
                    children.unshift(content);
                }
            }
            else {
                children = [content];
            }
            this.repairProps(props);
            return S.e(tag, props, children);
        }
    }

    /* Haven't tested this variation but it will add (merge in) new state into existing state without
     overwiting existing state */
    mergeState = (newState: any) => {
        if (!this.setState) {
            console.error("this.setState was null. initState was never called.");
            return;
        }

        this.setState(prevState => {
            // Object.assign would also work
            return { ...prevState, ...newState };
        });
    }

    /* Currently each react functional component must call this, because there's no clean way to wrap it since non-react methods
    have a null value for "this.render", by design */
    hookState = (newState: any) => {
        const [state, setState] = useState(newState);
        this.setState = setState;
        this.state = state;
    }

    /* Note: this method performs a direct state mod, but for react comps it gets overridden using useState return value */
    setState = null;

    // FYI: Here's how TypeScript defines these types (ReactNode v.s. ReactElement)
    // type ReactText = string | number;
    // type ReactChild = ReactElement | ReactText;

    // interface ReactNodeArray extends Array<ReactNode> {}
    // type ReactFragment = {} | ReactNodeArray;
    // type ReactNode = ReactChild | ReactFragment | ReactPortal | boolean | null | undefined;

    /* This is a little tricky, but what's happening here is that we define this render as null, and then 
    whichever derived classed implement themselves as 'react' an simply override the method to be the react-required method */
    render: ReactRenderFunc = null;
}
