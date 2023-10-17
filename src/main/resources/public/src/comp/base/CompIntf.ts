import { ReactNode } from "react";

export interface CompIntf {
    attribs: any;
    debug: boolean;
    ordinal: number;

    getId(prefix?: string): string;
    onMount(func: () => void): void;

    mergeState<T = any>(moreState: T): void;
    setState<T = any>(newState: T): void;
    getState<T = any>(): T;

    setClass(clazz: string): void;
    compRender(): ReactNode;
    addChild(comp: CompIntf): void;
    insertFirstChild(comp: CompIntf): void;
    hasChildren(): boolean;
    setChildren(comps: CompIntf[]): void;
    getChildren(): CompIntf[];
    getRef(warn: boolean): HTMLElement;
    render(props, ref): any;
    getCompClass(): string;
    reactNode(type: any, props?: object, childrenArg?: any[]): ReactNode;
    ordinalSortChildren(): void;
    preRender(): boolean;
}
