export interface DomBindIntf {
    init();

    //todo-0: there's lots of places this callback is being used and i should use promise instead.
    whenElm(domId: string, callback: Function);
}
