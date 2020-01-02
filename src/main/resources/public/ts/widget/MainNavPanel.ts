import { Constants } from "../Constants";
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

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MainNavPanel extends NavTag {

    constructor(attribs: any) {
        super(attribs);
        this.attribs.className = "navbar navbar-expand-sm navbar-dark bg-dark fixed-top";
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
                }, [
                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-chevron-circle-up", "Up Level", {
                            "onClick": e => { S.nav.navUpLevel(); },
                            "id": "upLevelButton",
                            "title": "Go to Parent SubNode"
                        },
                            //isEnabled func
                            () => { return S.meta64.currentNodeData && S.meta64.currentNodeData.node && S.nav.parentVisibleToUser(); },
                            //isVisible func
                            () => { return S.meta64.currentNodeData && S.meta64.currentNodeData.node && S.nav.parentVisibleToUser(); }
                        )
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-chevron-circle-left", null, {
                            "onClick": e => { S.nav.navToSibling(-1); },
                            "id": "upPrevSiblingButton",
                            "title": "Go to Previous SubNode"
                        },
                            //isEnabled func
                            () => { return true; },
                            //isVisible func
                            () => { return true; }
                        )
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-chevron-circle-right", null, {
                            "onClick": e => { S.nav.navToSibling(1); },
                            "id": "nextSiblingButton",
                            "title": "Go to Next SubNode"
                        },
                            //isEnabled func
                            () => { return true; },
                            //isVisible func
                            () => { return true; }
                        )
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-database", null, {
                            "onClick": e => { S.nav.navHome(); },
                            "id": "navHomeButton",
                            "title": "Go to Your Root Node"
                        })
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-home", null, {
                            "onClick": e => { S.meta64.loadAnonPageHome(); },
                            "id": "navHomeButton",
                            "title": "Go to Portal Root Node"
                        })
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-gear", null, {
                            "onClick": e => { S.edit.editPreferences(); },
                            "id": "navHomeButton",
                            "title": "Edit your Account Preferences"
                        })
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-pencil", null, {
                            "onClick": e => { S.nav.editMode(); },
                            "id": "editModeButton",
                            "title": "Toggle Edit Mode on/off"
                        },
                            //isEnabled func
                            () => { return S.meta64.state.allowEditMode; },
                            //isVisible func
                            () => { return S.meta64.state.allowEditMode; }
                        ),
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarButton("Signup", {
                            "onClick": e => { S.nav.signup(); },
                            "id": "openSignupPgButton",
                            "title": "Create new Quantizr Account"
                        },
                            //isEnabled func
                            () => { return S.meta64.isAnonUser; },
                            //isVisible func
                            () => { return S.meta64.isAnonUser; }
                        )
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-search", null, {
                            "onClick": e => { S.nav.search(); },
                            "id": "searchMainAppButton",
                            "title": "Search under selected node"
                        },
                            //isEnabled func
                            () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; },
                            //isVisible func
                            () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; }
                        ),
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-clock-o", null, {
                            "onClick": e => { S.srch.timeline("mtm"); },
                            "id": "timelineMainAppButton",
                            "title": "View Timeline of selected node (by Mod Time)"
                        },
                            //isEnabled func
                            () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; },
                            //isVisible func
                            () => { return !S.meta64.isAnonUser && S.meta64.state.highlightNode != null; }
                        ),
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-sign-in", "Login", {
                            "onClick": e => { S.nav.login(); },
                            "id": "openLoginDlgButton",
                            "title": "Login to Quantizr"
                        },
                            //isEnabled func
                            () => { return S.meta64.isAnonUser; },
                            //isVisible func
                            () => { return S.meta64.isAnonUser; }
                        )
                    ]),

                    new Li(null, {
                        className: "nav-item"
                    }, [
                        new NavBarIconButton("fa-sign-out", null, {
                            "onClick": e => { S.nav.logout(); },
                            "id": "navLogoutButton",
                            "title": "Logout"
                        },
                            //isEnabled func
                            () => { return !S.meta64.isAnonUser; },
                            //isVisible func
                            () => { return !S.meta64.isAnonUser; }
                        )
                    ])

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
                ])
            ]
            )
        ]);

        this.whenElm((elm: HTMLElement) => {
            //since we only ever set this height one time, and don't need it immediately i'm throwing in a timeout
            //just to be sure the browser has finished calculating it's offsetHeight, but I have no actual evidence or reason
            //to believe this timeout is necessary (but merely safer and harmless)
            setTimeout(() => {
                //see also: clientHeight, offsetHeight, scrollHeight
                S.meta64.navBarHeight = elm.offsetHeight;
            }, 750);
        });
    }

    render = (p) => {
        return this.tagRender('nav', this.content, p);
    }
}
