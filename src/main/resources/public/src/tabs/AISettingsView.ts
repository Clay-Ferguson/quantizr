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
import { TextField } from "../comp/core/TextField";
import { TabIntf } from "../intf/TabIntf";
import { Validator } from "../Validator";
import { Span } from "../comp/core/Span";
import { TextArea } from "../comp/core/TextArea";
import { ScrollPos } from "../comp/base/Comp";

export class AISettingsView extends AppTab<any, AISettingsView> {
    fileExtState: Validator = new Validator("");
    foldersToIncludeState: Validator = new Validator();
    foldersToIncludeScrollPos = new ScrollPos();

    constructor(data: TabIntf<any, AISettingsView>) {
        super(data);
        data.inst = this;
        this.fileExtState.setValue(getAs().userPrefs.aiAgentFileExtensions);
        this.foldersToIncludeState.setValue(getAs().userPrefs.aiAgentFoldersToInclude);
    }

    sectionTitle(title: string): Heading {
        return new Heading(6, title, { className: "settingsSectionTitle alert alert-primary" });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const horzClass = "marginTop marginBottom settingsSection";
        const settingsCol = getAs().mobileMode ? "mobileSettingsCol" : "settingsCol";

        const aiService: AIService = S.aiUtil.getServiceByName(getAs().userPrefs.aiService);
        const aiModelInfo = aiService && aiService.longDescription ? aiService.description + " -- " + aiService.longDescription : null;
        const aiOptions = S.aiUtil.getAiOptions();

        this.children = [
            this.headingBar = new TabHeading([
                new Div("AI Settings", { className: "tabTitle" })
            ], null),

            new Div(null, { className: "settingsPanel" }, [
                aiOptions?.length ? this.sectionTitle("AI - Artificial Intelligence") : null,
                aiOptions?.length ? new FlexRowLayout([
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
                            new Button("Add Credit", S.user.addAccountCredit, null, "btn btn-primary settingsButton")
                           : new Span("paymentLink not configured"),
                    ])
                ], horzClass) : null,

                S.quanta.config.aiAgentEnabled ? //
                    new Div("AI Agent Configuration", {
                        className: "settingsSectionTitle alert alert-primary"
                    }) : null,
                S.quanta.config.aiAgentEnabled ? new Div(null, {
                    className: "bigMarginRight"
                }, [
                    S.quanta.config.aiAgentEnabled ? new TextArea("Folders to Include", {
                        rows: 4,
                        placeholder: "List folders to include (optional)"
                    }, this.foldersToIncludeState, null, false, 3, this.foldersToIncludeScrollPos) : null,
                    S.quanta.config.aiAgentEnabled ? new TextField({ label: "File Extensions (ex: java,py,txt)", val: this.fileExtState }) : null,
                    new Button("Save", this.save, { className: "marginTop" })
                ]) : null,
            ])
        ];
        return true;
    }

    save = async () => {
        await S.util.saveUserPrefs(s => {
            s.userPrefs.aiAgentFileExtensions = this.fileExtState.getValue();
            s.userPrefs.aiAgentFoldersToInclude = this.foldersToIncludeState.getValue();
        });
        // flash confirmation message
        S.util.flashMessage("Saved settings", "Note");
    }

    settingsLink = (name: string, onClick: () => void, moreClasses: string = ""): Div => {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
