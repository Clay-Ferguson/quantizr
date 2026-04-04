import { getAs } from "../AppContext";
import { Clearfix } from "../comp/core/Clearfix";
import { Constants as C } from "../Constants";
import { FullScreenType } from "../Interfaces";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { Comp } from "./base/Comp";
import { Div } from "./core/Div";
import { Heading } from "./core/Heading";
import { Progress } from "./core/Progress";
import { FullScreenCalendar } from "./FullScreenCalendar";
import { FullScreenControlBar } from "./FullScreenControlBar";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { FullScreenImgViewer } from "./FullScreenImgViewer";
import { LeftNavPanel } from "./LeftNavPanel";
import { Main } from "./Main";
import { RightNavPanel } from "./RightNavPanel";
import { TabPanel } from "./TabPanel";

export class App extends Main {

    constructor() {
        super(null, { id: "appPanelId", role: "main" });
    }

    override preRender(): boolean | null {
        const ast = getAs();

        if (!ast.appInitComplete) {
            this.children = [new Progress()];
            return true;
        }

        const fullScreenViewer = this.getFullScreenViewer();
        this.attribs.className = "container-fluid mainContainer";

        if (fullScreenViewer) {
            this.children = [
                ast.fullScreenConfig.type !== FullScreenType.CALENDAR ? new FullScreenControlBar() : null,
                new Clearfix(),
                fullScreenViewer
            ];
        }
        else {
            if (S.quanta.config.requireCrypto && !S.crypto.avail) {
                this.children = [new Heading(4, S.quanta.config.brandingAppName + " requires a browser with crypto features.")];
                return true;
            }

            this.children = [
                new Div(null, {
                    className: Tailwind.row + " mainAppRow",
                    id: "appMainContainer"
                }, [
                    new LeftNavPanel(),
                    new TabPanel(),
                    !ast.showRhs ? null : new RightNavPanel()
                ])
            ];
        }

        if (ast.dialogStack?.length > 0) {
            this.addChildren(ast.dialogStack);
        }
        return true;
    }

    /* This is where we send an event that lets code hook into the render cycle to process whatever
        needs to be done AFTER the main render is complete, like doing scrolling for example */
    override _domUpdateEvent = () => {
        PubSub.pub(C.PUBSUB_mainWindowScroll);
        PubSub.pub(C.PUBSUB_postMainWindowScroll);
    };

    getFullScreenViewer(): Comp {
        switch (getAs().fullScreenConfig.type) {
            case FullScreenType.IMAGE:
                return new FullScreenImgViewer();
            case FullScreenType.GRAPH:
                return new FullScreenGraphViewer();
            case FullScreenType.CALENDAR:
                return new FullScreenCalendar();
            default:
                return null;
        }
    }

    override _domPreUpdateEvent = (): void => {
        const elm = this.getRef();
        if (!elm) return;

        const ast = getAs();

        if (ast.highlightText) {
            S.domUtil.highlightText(elm /* document.body */, ast.highlightText);
        }
    }
}
