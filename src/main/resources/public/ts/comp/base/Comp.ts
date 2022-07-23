import { createElement, ReactElement, ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import * as ReactDOM from "react-dom";
import { renderToString } from "react-dom/server";
import { Provider } from "react-redux";
import { store } from "../../AppRedux";
import { S } from "../../Singletons";
import { State } from "../../State";
import { CompIntf } from "./CompIntf";

/**
 * Base class for all components which encapsulates a lot of React functionality so that our implementation 
 * code can ignore those details.
 */
export abstract class Comp implements CompIntf {
    static renderCounter: number = 0;
    static focusElmId: string = null;
    public debug: boolean = false;
    public mounted: boolean = false;
    public rendered: boolean = false;
    private static guid: number = 0;

    attribs: any;

    /* Note: NULL elements are allowed in this array and simply don't render anything, and are required to be tolerated and ignored
    WARNING: TypeScript is NOT enforcing that children be private here.
    */
    private children: CompIntf[];

    // holds queue of functions to be ran once this component exists in the DOM.
    domAddFuncs: ((elm: HTMLElement) => void)[];

    // default all these to null so that unless derived class sets the value we never need
    // to create some of the useEffect calls
    public domPreUpdateEvent = null;
    public domUpdateEvent = null;
    public domRemoveEvent = null;
    public domAddEvent = null;

    constructor(attribs?: any, private stateMgr?: State) {
        this.attribs = attribs || {};

        /* If an ID was specifically provided, then use it, or else generate one */
        this.setId(this.attribs.id || ("c" + Comp.nextHex()));
    }

    public getRef = (): HTMLElement => {
        return this.attribs.ref?.current?.isConnected ? this.attribs.ref.current : null;
    }

    getId(): string {
        return this.attribs.id;
    }

    private setId(id: string) {
        this.attribs.id = id;

        if (!this.attribs.key) {
            this.attribs.key = id;
        }
    }

    getCompClass = (): string => {
        return this.constructor.name + "_" + this.getId();
    }

    static nextGuid(): number {
        return ++Comp.guid;
    }

    static nextHex(): string {
        return (++Comp.guid).toString(16)
    }

    /* Schedules a function to get run whenever this element comes into existence, or will cause
     the function to run immediately of the component is already mounted */
    whenElm(func: (elm: HTMLElement) => void) {
        // If we happen to already have the ref, we can run the 'func' immediately and be done
        // or else we add 'func' to the queue of functions to call when component does get mounted.
        let elm = this.getRef();
        if (elm) {
            func(elm);
            return;
        }

        if (this.debug) {
            console.log("queueing whenElm function on " + this.getCompClass());
        }

        // queue up the 'func' to be called once the domAddEvent gets executed.
        if (!this.domAddFuncs) {
            this.domAddFuncs = [];
        }

        this.domAddFuncs.push(func);
    }

    setClass(clazz: string): void {
        this.attribs.className = clazz;
    }

    insertFirstChild(comp: CompIntf): void {
        if (!comp) return;
        if (!this.children) {
            this.children = [];
        }
        this.children.unshift(comp);
    }

    addChild(comp: CompIntf): void {
        if (!comp) return;
        if (!this.children) {
            this.children = [];
        }
        this.children.push(comp);
    }

    addChildren(comps: Comp[]): void {
        if (!comps || comps.length === 0) return;
        if (!this.children) {
            this.children = [];
        }
        this.children.push.apply(this.children, comps);
    }

    /* Returns true if there are any non-null children */
    hasChildren(): boolean {
        return this.children?.some(child => !!child);
    }

    setChildren(comps: CompIntf[]) {
        this.children = comps;
    }

    getChildren(): CompIntf[] {
        return this.children;
    }

    getAttribs(): Object {
        return this.attribs;
    }

    renderHtmlElm(elm: ReactElement): string {
        return renderToString(elm);
    }

    /* Attaches a react element directly to the dom at the DOM id specified. */
    updateDOM(store: any = null, id: string = null) {
        if (!id) {
            id = this.getId();
        }

        // We call getElm here out of paranoia, but it's not needed. There are no places in our code where
        // we call into here when the element doesn't already exist.
        S.domUtil.getElm(id, (elm: HTMLElement) => {
            // See #RulesOfHooks in this file, for the reason we blow away the existing element to force a rebuild.
            ReactDOM.unmountComponentAtNode(elm);

            this.wrapClick(this.attribs);

            /* wrap with the Redux Provider to make it all reactive */
            let provider = createElement(Provider, { store }, this.create());
            ReactDOM.render(provider, elm);
        });
    }

    create = (): ReactNode => {
        return createElement(this.render, this.attribs);
    }

    wrapClick = (obj: any) => {
        let state = store.getState();
        if (!state.mouseEffect || !obj) return;
        if (obj.onClick) {
            // todo-0: need to use some way that can ensure (detect) that we don't can never double-wap by calling twice.
            obj.onClick = S.util.delayFunc(obj.onClick);
        }
    }

    buildChildren(): ReactNode[] {
        if (!this.children || this.children.length === 0) return null;

        return this.children.map((child: CompIntf) => {
            if (!child) return null;
            try {
                this.wrapClick(child.attribs);
                return child.create();
            }
            catch (e) {
                console.error("Failed to render child " + child.getCompClass() + " attribs.key=" + child.attribs.key);
                return null;
            }
        }).filter(child => !!child);
    }

    focus(): void {
        // immediately assign this as the focused element ID
        Comp.focusElmId = this.getId();

        this.whenElm((elm: HTMLElement) => {
            // if we're still the focused id, then we do the focus, but due to async nature some other thing
            // could have technically taken over focus and we might do nothing here.
            if (Comp.focusElmId === this.getId()) {
                S.domUtil.focusId(Comp.focusElmId);
            }
        });
    }

    /* Renders this node to a specific tag, including support for non-React children anywhere in the subgraph 
    Note: Tag can also be a type here, not just a string.
    */
    tag(type: any, content: string, props?: any, childrenArg?: CompIntf[]) {
        if (!props) {
            props = this.attribs;
        }

        // if children were provided use them.
        if (childrenArg) {
            this.children = childrenArg;
        }

        try {
            let children: ReactNode[] = this.buildChildren();

            // if we have children then add content as the first child ahead of all children
            if (children) {
                if (content) {
                    children.unshift(content);
                }
            }
            // otherwise use 'content' as the single array element or null if no content
            else {
                children = content ? [content] : null;
            }

            this.wrapClick(props);
            if (children?.length > 0) {
                // special case where tbody always needs to be immediate child of table
                // https://github.com/facebook/react/issues/5652
                if (type === "table") {
                    // this is just wrapping the children in a tbody and giving it a key so react won't panic.
                    return createElement(type, props, [createElement("tbody", { key: props.key + "_tbody" }, children)]);
                }
                else {
                    return createElement(type, props, children);
                }
            }
            else {
                return createElement(type, props);
            }
        }
        catch (e) {
            console.error("Failed in Comp.tagRender" + this.getCompClass() + " attribs=" + S.util.prettyPrint(this.attribs));
        }
    }

    checkState = (): boolean => {
        if (!this.stateMgr) {
            if (!this.rendered) {
                // we allow a lazy creation of a State as long as component hasn't rendered yet. This is becasue the
                // 'useState' can only be called inside the render method due to the "Rules of Hooks".
                // The normal pattern is that a component will call mergeState in the constructor to initialize some state
                this.stateMgr = new State();
            }
            else {
                console.error("non-state component " + this.getCompClass() + " attempted to use stateMgr, after renderd");
                return false;
            }
        }
        return true;
    }

    mergeState<ST = any>(moreState: ST): void {
        if (!this.checkState()) return;
        this.stateMgr.mergeState<ST>(moreState);
    }

    setState = <ST = any>(newState: ST): void => {
        if (!this.checkState()) return;
        this.stateMgr.setState<ST>(newState);
    }

    getState<ST = any>(): ST {
        if (!this.checkState()) return null;
        return this.stateMgr.state;
    }

    // todo-0: figure out why this hacky function is here, or if it's no longer needed.
    forceRender() {
        this.mergeState({ forceRender: Comp.nextGuid() } as any);
    }

    // Core 'render' function used by react. This is THE function for the functional component this object represents
    render = (): any => {
        this.rendered = true;

        if (this.debug) {
            console.log("render(): " + this.getCompClass());
        }
        try {
            if (this.stateMgr) {
                this.stateMgr.useState();
            }

            useEffect(() => {
                // Supposedly React 18+ will call useEffect twice on a mount so that's the only reason
                // I'm checking for !mounted here in this if condition.
                if (!this.mounted) {
                    this.mounted = true;
                    // because of the empty dependencies array in useEffect this only gets called once when the component mounts.
                    this.domAdd(); // call non-overridable method.
                    if (this.domAddEvent) this.domAddEvent(); // call overridable method.
                }

                // the return value of the useEffect function is what will get called when component unmounts
                return () => {
                    this.mounted = false;
                    if (this.domRemoveEvent) this.domRemoveEvent();
                };
            }, []);

            if (this.domUpdateEvent) useEffect(() => this.domUpdateEvent());
            if (this.domPreUpdateEvent) useLayoutEffect(() => this.domPreUpdateEvent());

            if (this.debug) {
                console.log("Calling preRender: " + this.getCompClass());
            }
            this.preRender();

            Comp.renderCounter++;
            if (this.debug) {
                console.log("render: " + this.getCompClass() + " counter=" + Comp.renderCounter + " ID=" + this.getId());
            }

            this.attribs.ref = useRef();
            return this.compRender();
        }
        catch (e) {
            console.error("Failed to render child (in render method)" + this.getCompClass() + " attribs.key=" + this.attribs.key + "\nError: " + e);
            return null;
        }
    }

    // leave NON-Arrow function to support calling thru 'super'
    domAdd(): void {
        // console.log("domAddEvent: " + this.jsClassName);
        let elm: HTMLElement = this.getRef();
        if (!elm) {
            return;
        }

        this.maybeFocus();
        this.runQueuedFuncs(elm);
    }

    maybeFocus = (): void => {
        /* React can loose focus so we manage that state ourselves using Comp.focusElmId */
        if (Comp.focusElmId && this.attribs.id === Comp.focusElmId) {
            S.domUtil.focusId(Comp.focusElmId);
        }
    }

    runQueuedFuncs = (elm: HTMLElement): void => {
        this.domAddFuncs?.forEach(func => func(elm));
        this.domAddFuncs = null;
    }

    /* Intended to be optionally overridable to set children, and the ONLY thing to be done in this method should be
    just to set the children */
    preRender(): void {
    }

    // This is the function you override/define to implement the actual render method, which is simple and decoupled from state
    // manageent aspects that are wrapped in 'render' which is what calls this, and the ONLY function that calls this.
    abstract compRender(): ReactNode;
}
