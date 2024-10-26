import { dispatch, getAs } from "../AppContext";
import { Constants as C } from "../Constants";
import { DocIndexPanel } from "../DocIndexPanel";
import { MenuPanel } from "../MenuPanel";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { Span } from "../comp/core/Span";
import { NavPanelDlg } from "../dlg/NavPanelDlg";
import { Comp } from "./base/Comp";
import { Button } from "./core/Button";
import { FlexRowLayout } from "./core/FlexRowLayout";

export class LeftNavPanel extends Comp {
    private static scrollPos: number = 0;
    public static inst: LeftNavPanel = null;

    constructor() {
        super({
            id: C.ID_LHS,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "1"
        });

        const ast = getAs();
        let cols = ast.userPrefs.mainPanelCols || 6;
        if (cols < 4) cols = 4;
        if (cols > 8) cols = 8;

        let leftCols = 4;
        if (cols >= 5) {
            leftCols--;
        }
        if (cols >= 7) {
            leftCols--;
        }

        this.attribs.className = Tailwind.getColClass(leftCols) + (ast.tour ? " appColumnTourActive" : " appColumn");
        LeftNavPanel.inst = this;
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const myMessages = ast.myNewMessageCount > 0
            ? (ast.myNewMessageCount + " new posts") : "";
        let showDocIndex = S.util.willRenderDocIndex();

        const docIndexToggle = showDocIndex ? new FlexRowLayout([
            new Span("Doc Index", {
                className: "bigMarginRight cursor-pointer" + (ast.menuIndexToggle == "index" ? " activeTab" : " inactiveTab"),
                onClick: () => dispatch("ToggleMenuIndex", s => s.menuIndexToggle = "index")
            }),
            new Span("Menu", {
                className: "mr-3 cursor-pointer" + (ast.menuIndexToggle == "menu" ? " activeTab" : " inactiveTab"),
                onClick: () => dispatch("ToggleMenuIndex", s => s.menuIndexToggle = "menu")
            })
        ], "mt-3") : null;

        if (showDocIndex) {
            showDocIndex = ast.menuIndexToggle == "index";
        }

        let scrollDiv = null;
        this.children = [
            scrollDiv = new Div(null, { className: "leftNavPanel customScrollbar" }, [
                new Div(null, { id: "appLHSHeaderPanelId", className: "lhsHeaderPanel" }, [
                    new Img({
                        className: "leftNavLogoImg",
                        src: "/branding/logo-50px-tr.jpg",
                        onClick: S.util._loadAnonPageHome,
                        title: "Go to Portal Home Node"
                    }),

                    new Span(null, { className: "tw-float-right" }, [
                        myMessages ? new Span(myMessages, {
                            className: "newMessagesNote",
                            onClick: S.nav._showMyNewMessages,
                            title: "Show your new messages"
                        }) : null,
                        // ast.userName && ast.isAnonUser ? new Icon({
                        //     className: "fa fa-bars fa-2x cursor-pointer",
                        //     onClick: () => dispatch("ToggleLHS", s => s.anonShowLHSMenu = !s.anonShowLHSMenu),
                        //     title: "Show Menu"
                        // }) : null,
                        !ast.showRhs ? new Button(null, () => new NavPanelDlg().open(), {
                            id: "navMenu"
                        }, "-primary menuButton", "fa-sitemap fa-lg") : null
                    ])
                ]),
                // ast.isAnonUser && ast.anonShowLHSMenu ? new TabPanelButtons(true, ast.mobileMode ? "rhsMenuMobile" : "rhsMenu") : null,
                docIndexToggle,
                !ast.isAnonUser && showDocIndex ? new DocIndexPanel() : null,
                ast.isAnonUser || showDocIndex ? null : new MenuPanel()
            ])
        ];

        scrollDiv.getScrollPos = (): number => {
            return LeftNavPanel.scrollPos;
        }

        scrollDiv.setScrollPos = (pos: number): void => {
            LeftNavPanel.scrollPos = pos;
        }

        return true;
    }
}
