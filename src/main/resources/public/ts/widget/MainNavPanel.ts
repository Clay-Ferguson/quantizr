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
import { SearchContentDlg } from "../dlg/SearchContentDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MainNavPanel extends NavTag {

    constructor(attribs: any) {
        super(attribs);

        // navbar-expand-sm would makes it collapsable, but messes up top margin.
        this.attribs.className = "navbar navbar-expand navbar-dark bg-dark fixed-top main-navbar";

        let buttons = [];

        buttons.push(new Li(null, {
            className: "nav-item"
        }, [
            new NavBarIconButton("fa-chevron-circle-up", "Up Level", {
                "onClick": e => { S.nav.navUpLevel(); },
                "title": "Go to Parent SubNode"
            },
                //isEnabled func
                () => { return S.meta64.currentNodeData && S.meta64.currentNodeData.node && S.nav.parentVisibleToUser(); },
                //isVisible func
                () => { return S.meta64.currentNodeData && S.meta64.currentNodeData.node && S.nav.parentVisibleToUser(); }
            )
        ]));

        /* Feature to read from clipboard might scare some users (as it should) so I'm turning this on only for admins
        until we have a more specific User Preference allowing users to have to opt-in (not opt-out) to use this feature 
        */
        if (!S.meta64.isAdminUser) {
            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-clipboard", null, {
                    "onClick": e => { S.edit.saveClipboardToNode(); },
                    "title": "Save Clipboard text to a Note"
                },
                    //isEnabled func
                    () => { return !S.meta64.isAnonUser },
                    //isVisible func
                    () => { return !S.meta64.isAnonUser }
                )
            ]));
        }

        if (!S.meta64.isMobile) {
            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-chevron-circle-left", null, {
                    "onClick": e => { S.nav.navToSibling(-1); },
                    "title": "Go to Previous SubNode"
                },
                    //isEnabled func
                    () => { return true; },
                    //isVisible func
                    () => { return true; }
                )
            ]));

            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-chevron-circle-right", null, {
                    "onClick": e => { S.nav.navToSibling(1); },
                    "title": "Go to Next SubNode"
                },
                    //isEnabled func
                    () => { return true; },
                    //isVisible func
                    () => { return true; }
                )
            ]));

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
                new NavBarIconButton("fa-pencil", null, {
                    "onClick": e => { S.nav.editMode(); },
                    "title": "Toggle Edit Mode on/off"
                },
                    //isEnabled func
                    () => { return S.meta64.state.allowEditMode; },
                    //isVisible func
                    () => { return S.meta64.state.allowEditMode; }
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

            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-search", null, {
                    "onClick": e => { new SearchContentDlg().open(); },
                    "title": "Search under selected node"
                },
                    //isEnabled func
                    () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; },
                    //isVisible func
                    () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; }
                ),
            ]));

            buttons.push(new Li(null, {
                className: "nav-item"
            }, [
                new NavBarIconButton("fa-clock-o", null, {
                    "onClick": e => { S.srch.timeline("mtm"); },
                    "title": "View Timeline of selected node (by Mod Time)"
                },
                    //isEnabled func
                    () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; },
                    //isVisible func
                    () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; }
                ),
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
                        "onClick": e => { S.nav.showMainMenu(); },
                        "id": "mainMenu",
                        "title": "Show Main Menu"
                    })
                ]),
            ]),

            new Span("", {
                className: "navbar-brand",
                "id": "headerAppName"
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

        this.whenElm((elm: HTMLElement) => {
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

            /* This DnD is just tinkering now, but the eventual goal is to have
            the app automatically create a subnode whenever you drop something */
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
        });
    }

    compRender = (): ReactNode => {
        return this.tagRender('nav', this.content, this.attribs);
    }
}
