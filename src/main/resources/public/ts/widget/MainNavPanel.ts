import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Ul } from "./Ul";
import { Li } from "./Li";
import { NavTag } from "./NavTag";
import { NavBarButton } from "./NavBarButton";
import { ButtonTag } from "./ButtonTag";
import { Span } from "./Span";
import { NavBarIconButton } from "./NavBarIconButton";
import { Div } from "./Div";
import { ReactNode } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MainNavPanel extends NavTag {

    constructor(attribs: any) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        //console.log("Rendering MainNavPanel");

        const title = useSelector((state: AppState) => state.title);
        const nodesToMove = useSelector((state: AppState) => state.nodesToMove);
        const mstate = useSelector((state: AppState) => state.mstate);
        const dispatch = useDispatch();

        // navbar-expand-sm would makes it collapsable, but messes up top margin.
        this.attribs.className = "navbar navbar-expand navbar-dark bg-dark fixed-top main-navbar";
        let buttons = [];

        /* Feature to read from clipboard might scare some users (as it should) so I'm turning this on only for admins
        until we have a more specific User Preference allowing users to have to opt-in (not opt-out) to use this feature 
        */
        buttons.push(new Li(null, {
            className: "nav-item"
        }, [
            new NavBarIconButton("fa-clipboard", null, {
                "onClick": e => { S.edit.saveClipboardToNode(); },
                "title": "Save Clipboard text to a Note"
            },
                //isEnabled func
                () => { return S.meta64.isAdminUser /* !S.meta64.isAnonUser */ },
                //isVisible func
                () => { return S.meta64.isAdminUser /* !S.meta64.isAnonUser */ }
            )
        ]));

        if (!S.meta64.isMobile) {
            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-database", null, {
                    "onClick": e => { S.nav.navHome(); },
                    "title": "Go to Your Root Node"
                },
                    //isEnabled func
                    () => { return !S.meta64.isAnonUser; },
                    //isVisible func
                    () => { return !S.meta64.isAnonUser; })
            ]));

            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-home", null, {
                    "onClick": e => { S.meta64.loadAnonPageHome(); },
                    "title": "Go to Portal Root Node"
                })
            ]));

            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-gear", null, {
                    "onClick": e => { S.edit.editPreferences(); },
                    "title": "Edit your Account Preferences"
                },
                    //isEnabled func
                    () => { return !S.meta64.isAnonUser; },
                    //isVisible func
                    () => { return !S.meta64.isAnonUser; })
            ]));

            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                //todo-0: this isn't showing up. Probably need ALL this stuff in AppState (all enablement vars)
                new NavBarIconButton("fa-pencil", null, {
                    "onClick": e => { S.nav.editMode(); },
                    "title": "Toggle Edit Mode on/off"
                },
                    //isEnabled func
                    () => { return mstate.allowEditMode; },
                    //isVisible func
                    () => { return mstate.allowEditMode; }
                ),
            ]));

            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarButton("Signup", {
                    "onClick": e => { S.nav.signup(); },
                    "title": "Create new Quantizr Account"
                },
                    //isEnabled func
                    () => { return S.meta64.isAnonUser; },
                    //isVisible func
                    () => { return S.meta64.isAnonUser; }
                )
            ]));
        }

        buttons.push(new Li(null, {
            className: "nav-item"
        }, [
            new NavBarIconButton("fa-sign-in", "Login", {
                "onClick": e => { S.nav.login(); },
                "title": "Login to Quantizr"
            },
                //isEnabled func
                () => { return S.meta64.isAnonUser; },
                //isVisible func
                () => { return S.meta64.isAnonUser; }
            )
        ]));

        buttons.push(new Li(null, {
            className: "nav-item"
        }, [
            new NavBarIconButton("fa-sign-out", null, {
                "onClick": e => { S.nav.logout(); },
                "title": "Logout"
            },
                //isEnabled func
                () => { return !S.meta64.isAnonUser; },
                //isVisible func
                () => { return !S.meta64.isAnonUser; }
            )
        ]));

        //example of a dropdown menu would go here.
        // <li class="nav-item dropdown">
        //     <a class="nav-link dropdown-toggle" href="http://example.com" id="dropdown01" data-toggle="dropdown"
        //     aria-haspopup="true" aria-expanded="false">Dropdown</a>
        //     <div class="dropdown-menu" aria-labelledby="dropdown01">
        //     <a class="dropdown-item" href="#">Action</a>
        //     <a class="dropdown-item" href="#">Another action</a>
        //     <a class="dropdown-item" href="#">Something else here</a>
        //     </div>
        // </li>

        this.setChildren([
            new Ul(null, {
                className: "navbar-nav"
            }, [
                new Li(null, {
                    className: "nav-item"
                }, [
                    new NavBarIconButton("fa-bars", "Quantizr", {
                        "onClick": e => {
                            S.nav.showMainMenu(nodesToMove, mstate);
                        },
                        "id": "mainMenu",
                        "title": "Show Main Menu"
                    })
                ]),
            ]),

            new Span(title, {
                className: "navbar-brand",
            }),

            new ButtonTag(null, {
                className: "navbar-toggler",
                "type": "button",
                "data-toggle": "collapse",
                "data-target": "#navbarsMainNav",
                "aria-controls": "navbarsMainNav",
                "aria-expanded": "false",
                "aria-label": "Toggle navigation"
            }),

            new Div(null, {
                className: "collapse navbar-collapse",
                "id": "navbarsMainNav"
            }, [
                //I don't need any left-justified navbar items for now, but also without this "mr-auto" empty navbar-nav
                //element here also the right justified ones won't even work and all get force to left.
                new Ul(null, {
                    className: "navbar-nav mr-auto"
                }, [
                    // new Div("[howdy]")
                ]),

                new Ul(null, {
                    className: "navbar-nav"
                }, buttons)
            ])
        ]);

        return this.tagRender('nav', this.content, this.attribs);
    }

    super_domAddEvent: any = this.domAddEvent;
    domAddEvent = (): void => {
        console.log("overridden domAddEvent: " + this.jsClassName);
        let elm: HTMLElement = this.getElement();

        //since we only ever set this height one time, and don't need it immediately i'm throwing in a timeout
        //just to be sure the browser has finished calculating it's offsetHeight, but I have no actual evidence or reason
        //to believe this timeout is necessary (but merely safer and harmless)
        setTimeout(() => {
            //see also: clientHeight, offsetHeight, scrollHeight
            S.meta64.navBarHeight = elm.offsetHeight;
        }, 750);

        elm.addEventListener("dragenter", (event) => {
            //console.log('DRAGENTER: ' + S.util.prettyPrint(event));
            event.preventDefault();
        });

        elm.addEventListener("dragover", (event) => {
            //console.log('DRAGOVER: ' + S.util.prettyPrint(event));
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';  // See the section on the DataTransfer object.
        });

        elm.addEventListener("drop", (ev) => {
            ev.stopPropagation();
            ev.preventDefault();

            //var imageUrl = evt.dataTransfer.getData('URL');
            //var imageUrl = evt.dataTransfer.getData('text/html');

            let data = ev.dataTransfer.items;
            for (let i = 0; i < data.length; i++) {
                let d = data[i];
                console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

                if ((d.kind == 'string') &&
                    (d.type.match('^text/plain'))) {
                }

                d.getAsString((s) => {
                    //This detects drops, successfully but I'm not using it yet.
                    console.log("DROP STRING[" + i + "]: " + s);
                });

                // else if ((data[i].kind == 'string') &&
                //     (data[i].type.match('^text/html'))) {
                //     // Drag data item is HTML
                //     console.log("... Drop: HTML");
                // } else if ((data[i].kind == 'string') &&
                //     (data[i].type.match('^text/uri-list'))) {
                //     // Drag data item is URI
                //     console.log("... Drop: URI");
                // } else if ((data[i].kind == 'file') &&
                //     (data[i].type.match('^image/'))) {
                //     // Drag data item is an image file
                //     var f = data[i].getAsFile();
                //     console.log("... Drop: File ");
                // }
            }
        });
    }
}
