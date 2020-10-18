import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { MenuPanel } from "../MenuPanel";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";
import { IconButton } from "./IconButton";
import { Img } from "./Img";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LeftNavPanel extends Div {

    constructor() {
        super();
        this.attribs.className = "col-" + C.leftNavPanelCols + " leftNavPanel position-fixed customScrollbar";
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        let allowEditMode = state.node && !state.isAnonUser;

        let signupButton = state.isAnonUser ? new IconButton("fa-user-plus", "Signup", {
            onClick: e => { S.nav.signup(state); },
            title: "Create new Account"
        }, "btn-primary", "off") : null;

        let loginButton = state.isAnonUser ? new IconButton("fa-sign-in", "Login", {
            onClick: e => { S.nav.login(state); },
            title: "Login to Quanta"
        }, "btn-primary", "off") : null;

        // new IconButton(clientInfo.isMobile ? "fa-bars" : null, "Quanta", {
        //     onClick: e => {
        //         // If user is not logged in this button just takes you back to the landing page.
        //         if (state.isAnonUser || !clientInfo.isMobile) {
        //             window.location.href = window.location.origin;
        //         }
        //         else {
        //             if (clientInfo.isMobile) {
        //                 S.nav.showMainMenu(state);
        //             }
        //         }
        //     },
        //     id: "mainMenu"
        //     // only applies to mobile. just don't show title for now.
        //     // title: "Show Main Menu"
        // }, "nav-link btn-primary", "off", "/images/eagle-logo-50px-tr.jpg")

        this.setChildren([
            allowEditMode ? new IconButton("fa-pencil", null, {
                onClick: e => { S.edit.toggleEditMode(state); },
                title: "Turn Edit Mode " + (state.userPreferences.editMode ? "off" : "on")
            }, "float-right btn-secondary", state.userPreferences.editMode ? "on" : "off") : null,

            new Img(this.getId() + "_logo", { src: "/images/eagle-logo-50px-tr.jpg" }),
            new Div(state.title),

            new Div(null, {
                className: "float-right menuContainer"
            }, [
                signupButton,
                loginButton,
                new MenuPanel(state)
            ])
        ]);
    }

    // This was originally on the toolbar at top of page but if we bring this back it will be here (probably)
    // domAddEvent(): void {
    //     let elm: HTMLElement = this.getElement();

    //     // since we only ever set this height one time, and don't need it immediately i'm throwing in a timeout
    //     // just to be sure the browser has finished calculating it's offsetHeight, but I have no actual evidence or reason
    //     // to believe this timeout is necessary (but merely safer and harmless)
    //     setTimeout(() => {
    //         // see also: clientHeight, offsetHeight, scrollHeight
    //         // NOTE: I added the additional 20, when I went to 'container-fluid' instead of 'container' for the main
    //         // panel, which I needed to do after adding the left and right panels to the main layout.
    //         S.meta64.navBarHeight = elm.offsetHeight + 20;
    //     }, 750);

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
