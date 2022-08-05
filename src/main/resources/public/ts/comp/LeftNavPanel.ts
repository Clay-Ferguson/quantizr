import { getAppState, useAppState } from "../AppRedux";
import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { Span } from "../comp/core/Span";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import { MenuPanel } from "../MenuPanel";
import { S } from "../Singletons";

declare var g_brandingAppName: string;

export class LeftNavPanel extends Div {
    private static scrollPos: number = 0;
    public static inst: LeftNavPanel = null;

    constructor() {
        super(null, {
            id: C.ID_LHS,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "1"
        });

        const state = getAppState();

        let cols = state.userPrefs.mainPanelCols || 6;
        if (cols < 4) cols = 4;
        if (cols > 8) cols = 8;

        let leftCols = 4;
        if (cols >= 5) {
            leftCols--;
        }
        if (cols >= 7) {
            leftCols--;
        }

        // console.log("centerCols: " + panelCols + " leftCols: " + leftCols);
        this.attribs.className = "col-" + leftCols + " leftNavPanel customScrollbar";
        LeftNavPanel.inst = this;
    }

    getScrollPos = (): number => {
        return LeftNavPanel.scrollPos;
    }

    setScrollPos = (pos: number): void => {
        LeftNavPanel.scrollPos = pos;
    }

    preRender(): void {
        const state = useAppState();
        const feedData: TabIntf = S.tabUtil.getTabDataById(state, C.TAB_FEED);

        const s = state.newMessageCount > 1 ? "s" : "";
        let messages = state.newMessageCount > 0
            ? (state.newMessageCount + " message" + s) : "";

        // todo-2: this is a hack to keep the new incomming "chat" messages (Node Feed) from tricking
        // user into clicking on it which takes them AWAY from the chat. We do this by setting messages to null
        // if feedFilterRoodNode is non-null which means user is in a node chat. I should consider having
        // a "Chat" tab that's separate from the "Feed" tab. Maybe the ChatView should be subclass of FeedView?
        if (feedData?.props?.feedFilterRootNode) {
            messages = null;
        }

        this.setChildren([
            new Div(null, { id: "appLHSHeaderPanelId" }, [
                new Img(this.getId("logo_"), {
                    className: "leftNavLogoImg",
                    src: "/branding/logo-50px-tr.jpg",
                    onClick: () => S.util.loadAnonPageHome(),
                    title: "Go to Portal Home Node"
                }),
                new Span(g_brandingAppName, {
                    className: "logo-text",
                    onClick: () => S.util.loadAnonPageHome(),
                    title: "Go to Portal Home Node"
                }),
                // todo-2: need to add a similar message over to the 'logo-text' that's active for mobile
                // which is in a different class.
                messages ? new Span(messages, {
                    className: "logo-text-small float-end",
                    onClick: () => S.nav.showMyNewMessages(),
                    title: "Show new messages"
                }) : null
            ]),
            new MenuPanel(state)
        ]);
    }

    // This was originally on the toolbar at top of page but if we bring this back it will be here (probably)
    // domAddEvent(): void {
    //     let elm: HTMLElement = this.getRef();

    //     elm.addEventListener("dragenter", (event) => {
    //         // console.log('DRAGENTER: ' + S.util.prettyPrint(event));
    //         event.preventDefault();
    //     });

    //     elm.addEventListener("dragover", (event) => {
    //         // console.log('DRAGOVER: ' + S.util.prettyPrint(event));
    //         event.preventDefault();
    //         event.dataTransfer.dropEffect = "copy"; // See the section on the DataTransfer object.
    //     });

    //     elm.addEventListener("drop", (ev) => {
    //         ev.stopPropagation();
    //         ev.preventDefault();

    //         // var imageUrl = evt.dataTransfer.getData('URL');
    //         // var imageUrl = evt.dataTransfer.getData('text/html');

    //         let data = ev.dataTransfer.items;
    //         for (let i = 0; i < data.length; i++) {
    //             let d = data[i];
    //             console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

    //             if ((d.kind === "string") &&
    //                 (d.type.match("^text/plain"))) {
    //             }

    //             d.getAsString((s) => {
    //                 // This detects drops, successfully but I'm not using it yet.
    //                 console.log("DROP STRING[" + i + "]: " + s);
    //             });

    //             // else if ((data[i].kind == 'string') &&
    //             //     (data[i].type.match('^text/html'))) {
    //             //     // Drag data item is HTML
    //             //     console.log("... Drop: HTML");
    //             // } else if ((data[i].kind == 'string') &&
    //             //     (data[i].type.match('^text/uri-list'))) {
    //             //     // Drag data item is URI
    //             //     console.log("... Drop: URI");
    //             // } else if ((data[i].kind == 'file') &&
    //             //     (data[i].type.match('^image/'))) {
    //             //     // Drag data item is an image file
    //             //     var f = data[i].getAsFile();
    //             //     console.log("... Drop: File ");
    //             // }
    //         }
    //     });
    // }
}
