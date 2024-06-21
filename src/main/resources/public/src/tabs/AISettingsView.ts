import { AIService } from "../AIUtil";
import { getAs } from "../AppContext";
import { S } from "../Singletons";
import { AppTab } from "../comp/AppTab";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Heading } from "../comp/core/Heading";
import { Selection } from "../comp/core/Selection";
import { TabHeading } from "../comp/core/TabHeading";
import { TabIntf } from "../intf/TabIntf";

export class AISettingsView extends AppTab<any, AISettingsView> {
    constructor(data: TabIntf<any, AISettingsView>) {
        super(data);
        data.inst = this;
    }

    sectionTitle(title: string): Heading {
        return new Heading(6, title, { className: "settingsSectionTitle alert alert-primary" });
    }

    override preRender = (): boolean => {
        const ast = getAs();
        const horzClass = "marginTop marginBottom settingsSection";
        const settingsCol = getAs().mobileMode ? "mobileSettingsCol" : "settingsCol";

        const aiService: AIService = S.aiUtil.getServiceByName(getAs().userPrefs.aiService);
        const aiModelInfo = aiService && aiService.longDescription ? aiService.description + " -- " + aiService.longDescription : null;
        const aiOptions = S.aiUtil.getAiOptions();

        this.setChildren([
            this.headingBar = new TabHeading([
                new Div("AI Settings", { className: "tabTitle" })
            ], null),

            new Div(null, { className: "settingsPanel" }, [
                // -----------------------
                aiOptions?.length ? this.sectionTitle("AI - Artificial Intelligence") : null,
                aiOptions?.length ? new FlexRowLayout([
                    // todo-0: need to make this string configurable, maybe in yaml file? (NOTE: This appears twice in the code)
                    new Div("Tip: Anthropic's Claude 3.5 Sonnet is currently the most powerful AI in the world.", { className: "marginBottom" }),
                    // todo-1: need a way to warn user when something unsupported by their admin configuration is selected
                    new Div(null, { className: settingsCol }, [
                        new Selection(null, "AI Service", aiOptions, "aiServiceSelection", "bigMarginLeft bigMarginTop bigMarginBottom", {
                            setValue: (val: string) => S.edit.setAiService(val),
                            getValue: (): string => "" + getAs().userPrefs.aiService
                        }),
                        aiModelInfo ? new Div(aiModelInfo, { className: "bigMarginLeft" }) : null
                    ]),
                    new Div(null, { className: settingsCol }, [
                        ast.userProfile?.balance ? this.settingsLink("Credit: $" + ast.userProfile.balance?.toFixed(6), () => { }) : null,
                        S.quanta.config.paymentLink ?
                            new Button("Add Credit", S.user.addAccountCredit, null, "btn btn-primary settingsButton") : null,
                    ])

                ], horzClass) : null,
            ])
        ]);
        return true;
    }

    settingsLink = (name: string, onClick: () => void, moreClasses: string = ""): Div => {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
