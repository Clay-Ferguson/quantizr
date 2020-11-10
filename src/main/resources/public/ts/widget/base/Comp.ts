// https://reactjs.org/docs/react-api.html
// https://reactjs.org/docs/hooks-reference.html#usestate
// #RulesOfHooks: https://fb.me/rules-of-hooks

import { ReactElement, ReactNode, useEffect, useLayoutEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import { renderToString } from "react-dom/server";
import { Provider } from "react-redux";
import { Constants as C } from "../../Constants";
import { PubSub } from "../../PubSub";
import { Singletons } from "../../Singletons";
import { State } from "../../State";
import { BaseCompState } from "./BaseCompState";
import { CompIntf } from "./CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/**
 * This base class is a hybrid that can render React components or can be used to render plain HTML to be used in innerHTML of elements.
 * The innerHTML approach is being phased out in order to transition fully over to normal ReactJS.
 */
export abstract class Comp<S extends BaseCompState = any> implements CompIntf {
    static renderCounter: number = 0;
    public rendered: boolean = false;
    public debug: boolean = false;
    public debugState: boolean = false;
    private static guid: number = 0;

    /*
    DO NOT DELETE:
    This is one way that should work, but isn't being used because we're using
    the domAddEvent method let us know when the element is visible, which should be just
    as efficient, and isn't using any timers. The way this should work is any
    constructor can set 'referenced' to true to trigger 'ref' to get set during render. */
    // public referenced: boolean;
    // private ref: any;

    attribs: any;

    /* Note: NULL elements are allowed in this array and simply don't render anything, and are required to be tolerated and ignored */
    private children: CompIntf[];

    logEnablementLogic: boolean = true;
    jsClassName: string;
    clazz: string;

    // holds queue of functions to be ran once this component is rendered.
    domAddFuncs: ((elm: HTMLElement) => void)[];

    renderRawHtml: boolean = false;

    /**
     * 'react' should be true only if this component and all its decendants are true React components that are rendered and
     * controlled by ReactJS (rather than our own innerHTML)
     *
     * allowRect can be set to false for components that are known to be used in cases where not all of their subchildren are react or for
     * whatever reason we want to disable react rendering, and fall back on render-to-text approach
     */
    constructor(attribs?: any, private s?: State<S>) {
        if (!s) {
            this.s = new State<S>();
        }
        this.attribs = attribs || {};
        this.children = [];

        /* If an ID was specifically provided, then use it, or else generate one */
        let id = this.attribs.id || ("c" + Comp.nextGuid());
        this.clazz = this.constructor.name;
        this.setId(id);
    }

    private setId(id: string) {
        this.attribs.id = id;
        this.attribs.key = id;
        this.jsClassName = this.constructor.name + "_" + id;
    }

    /* Returns true if there are any non-null children */
    childrenExist(): boolean {
        if (this.children == null || this.children.length === 0) return false;
        return this.children.some(child => !!child);
    }

    static nextGuid(): number {
        return ++Comp.guid;
    }

    getId(): string {
        return this.attribs.id;
    }

    /* Warning: Under lots of circumstances it's better to call util.getElm rather than getElement() because getElement returns
    null unless the element is already created and rendered onto the DOM */
    getElement(): HTMLElement {
        // DO NOT DELETE
        // if (this.ref && this.ref.current) {
        //     // console.log("***** got element from ref! " + this.jsClassName);
        //     return this.ref.current;
        // }
        // console.log("*** getting element from old-school dom call.");
        return <HTMLElement>document.getElementById(this.getId());
    }

    // This is the original implementation of whenElm which uses a timer to wait for the element to come into existence
    // and is only used in one odd place where we manually attach Dialogs to the DOM (see DialogBase.ts)
    whenElmEx(func: (elm: HTMLElement) => void) {
        S.util.getElm(this.getId(), func);
    }

    // WARNING: Use whenElmEx for DialogBase derived components!
    whenElm(func: (elm: HTMLElement) => void) {
        // console.log("whenElm running for " + this.jsClassName);

        let elm = this.getElement();
        if (elm) {
            // console.log("Looked for and FOUND on DOM: " + this.jsClassName);
            func(elm);
            return;
        }

        // console.log("queueing a whenElm function on " + this.jsClassName);
        // queue up the 'func' to be called once the domAddEvent gets executed.
        if (!this.domAddFuncs) {
            this.domAddFuncs = [func];
        }
        else {
            this.domAddFuncs.push(func);
        }
    }

    setVisible(visible: boolean) {
        this.mergeState({ visible } as any);
    }

    setEnabled(enabled: boolean) {
        this.mergeState({ enabled } as any);
    }

    setClass(clazz: string): void {
        this.attribs.className = clazz;
    }

    setInnerHTML(html: string) {
        this.whenElm(function (elm: HTMLElement) {
            elm.innerHTML = html;
        });
    }

    addChild(comp: CompIntf): void {
        if (!comp) return;
        if (!this.children) {
            this.children = [];
        }
        this.children.push(comp);
    }

    addChildren(comps: Comp[]): void {
        if (!this.children) {
            this.children = [];
        }
        this.children.push.apply(this.children, comps);
    }

    setChildren(comps: CompIntf[]) {
        this.children = comps || [];
    }

    getChildren(): CompIntf[] {
        if (!this.children) {
            this.children = [];
        }
        return this.children;
    }

    getAttribs(): Object {
        return this.attribs;
    }

    renderHtmlElm(elm: ReactElement): string {
        return renderToString(elm);
        // return renderToStaticMarkup(elm);
    }

    reactRenderHtmlInDiv(): string {
        this.updateDOM(null, this.getId() + "_re");
        return "<div id='" + this.getId() + "_re'></div>";
    }

    reactRenderHtmlInSpan(): string {
        this.updateDOM(null, this.getId() + "_re");
        return "<span id='" + this.getId() + "_re'></span>";
    }

    /* Attaches a react element directly to the dom at the DOM id specified.
       WARNING: This can only re-render the *children* under the target node and not the attributes or tag of the node itself.

       Also this can only re-render TOP LEVEL elements, meaning elements that are not children of other React Elements, but attached
       to the DOM old-school.
    */
    updateDOM(store: any = null, id: string = null) {
        if (!id) {
            id = this.getId();
        }
        // if (!this.render) {
        //     throw new Error("Attempted to treat non-react component as react: " + this.constructor.name);
        // }
        S.util.getElm(id, (elm: HTMLElement) => {
            // See #RulesOfHooks in this file, for the reason we blowaway the existing element to force a rebuild.
            ReactDOM.unmountComponentAtNode(elm);

            (this._render as any).displayName = this.jsClassName;
            let reactElm = S.e(this._render, this.attribs);

            /* If this component has a store then wrap with the Redux Provider to make it all reactive */
            if (store) {
                // console.log("Rendering with provider");
                let provider = S.e(Provider, { store }, reactElm);
                ReactDOM.render(provider, elm);
            }
            else {
                ReactDOM.render(reactElm, elm);
            }
        });
    }

    buildChildren(): ReactNode[] {
        // console.log("buildChildren: " + this.jsClassName);
        if (this.children == null || this.children.length === 0) return null;
        let reChildren: ReactNode[] = [];

        this.children.forEach(function (child: Comp) {
            if (child) {
                let reChild: ReactNode = null;
                try {
                    // console.log("ChildRender: " + child.jsClassName);
                    (this._render as any).displayName = child.jsClassName;
                    reChild = S.e(child._render, child.attribs);
                }
                catch (e) {
                    console.error("Failed to render child " + child.jsClassName + " attribs.key=" + child.attribs.key);
                }

                if (reChild) {
                    reChildren.push(reChild);
                }
                else {
                    // console.log("ChildRendered to null: " + child.jsClassName);
                }
            }
        }, this);
        return reChildren;
    }

    focus(): void {
        this.whenElm((elm: HTMLSelectElement) => {
            S.util.delayedFocus(this.getId());
        });
    }

    updateVisAndEnablement() {
        if (this.s.state.enabled === undefined) {
            this.s.state.enabled = true;
        }

        if (this.s.state.visible === undefined) {
            this.s.state.visible = true;
        }
    }

    /* Renders this node to a specific tag, including support for non-React children anywhere in the subgraph */
    tagRender(tag: string, content: string, props: any) {
        // console.log("Comp.tagRender: " + this.jsClassName + " id=" + props.id);
        this.updateVisAndEnablement();

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
                // console.log("Render Tag with children.");
                return S.e(tag, props, children);
            }
            else {
                // console.log("Render Tag no children.");
                return S.e(tag, props);
            }
        }
        catch (e) {
            console.error("Failed in Comp.tagRender" + this.jsClassName + " attribs=" + S.util.prettyPrint(this.attribs));
        }
    }

    /* This is how you can add properties and overwrite them in existing state. Since all components are assumed to have
       both visible/enbled properties, this is the safest way to set other state that leaves visible/enabled props intact
       */
    mergeState(moreState: S): any {
        this.s.mergeState(moreState);
    }

    forceRender() {
        this.mergeState({ forceRender: Comp.nextGuid() } as any);
    }

    setState = (newState: any): any => {
        this.s.setState(newState);
    }

    /* Note: this method performs a direct state mod, until react overrides it using useState return value

    To add new properties...use this pattern (mergeState above does this)
    setStateFunc(prevState => {
        // Object.assign would also work
        return {...prevState, ...updatedValues};
    });

    There are places where 'mergeState' works but 'setState' fails, that needs investigation like EditNodeDlg.
    */
    setStateEx(state: any) {
        this.s.setStateEx(state);
    }

    getState(): S {
        return this.s.state;
    }

    // Core 'render' function used by react. Never really any need to override this, but it's theoretically possible.
    _render = (props: any): ReactNode => {
        // console.log("render(): " + this.jsClassName);
        this.rendered = true;

        let ret: ReactNode = null;
        try {
            this.s.useState();

            // DO NOT DELETE
            // if (this.referenced) {
            //     // console.log("Element is referenced: " + this.jsClassName);
            //     // NOTE: ref.current will get set to the actual DOM element once available.
            //     this.ref = useRef(null);
            // }

            if (!this._domAddEvent) {
                this._domAddEvent = this.domAddEvent.bind(this);
            }

            useEffect(this._domAddEvent, []);

            // This hook should work fine but just isn't needed yet.
            if (this.domUpdateEvent) {
                useEffect(this.domUpdateEvent);
            }

            if (this.domPreUpdateEvent) {
                useLayoutEffect(this.domPreUpdateEvent);
            }

            /*
            This 'useEffect' call makes react call 'domRemoveEvent' once the dom element is removed from the acutal DOM.
            (NOTE: Remember this won't run for DialogBase because it's done using pure DOM Javascript, which is the same reason
            whenElmEx has to still exist right now)
            */
            if (this.domRemoveEvent) {
                useEffect(() => {
                    return this.domRemoveEvent;
                }, []);
            }

            this.updateVisAndEnablement();

            /* Theoretically we could avoid calling preRender if it weren't for the fact that React monitors
            which hooks get called at each render cycle, so if we bypass the preRender because we wont' be using
            the children it generates, react will still throw an error becasue the calls to those hooks will not have been made.

            DO NOT DELETE THE COMMENTNED IF BELOW (it serves as warning of what NOT to do.)
            */
            this.preRender();

            Comp.renderCounter++;
            if (this.debug) {
                console.log("calling compRender: " + this.jsClassName + " counter=" + Comp.renderCounter); // + " PROPS=" + S.util.prettyPrint(props));
            }

            ret = this.compRender();
        }
        catch (e) {
            // todo-1: this is not logging the stack
            console.error("Failed to render child (in render method)" + this.jsClassName + " attribs.key=" + this.attribs.key + " Error: " + e);
        }

        return ret;
    }

    domRemoveEvent = null;
    domUpdateEvent = null;
    domPreUpdateEvent = null;

    _domAddEvent: () => void = null;
    domAddEvent(): void {
        // console.log("domAddEvent: " + this.jsClassName);

        if (this.domAddFuncs) {
            let elm: HTMLElement = this.getElement();
            if (!elm) {
                console.error("elm not found in domAddEvent: " + this.jsClassName);
                return;
            }
            else {
                // console.log("domAddFuncs running for "+this.jsClassName+" for "+this.domAddFuncs.length+" functions.");
            }
            this.domAddFuncs.forEach(function (func) {
                func(elm);
            }, this);
            this.domAddFuncs = null;
        }
    }

    /* Intended to be optionally overridable to set children, and the ONLY thing to be done in this method should also be
    just to set the children */
    preRender(): void {
    }

    // This is the function you override/define to implement the actual render method, which is simple and decoupled from state
    // manageent aspects that are wrapped in 'render' which is what calls this, and the ONLY function that calls this.
    abstract compRender(): ReactNode;
}
