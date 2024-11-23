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
import { TabBase } from "../intf/TabBase";
import { Validator } from "../Validator";
import { Span } from "../comp/core/Span";
import { TextArea } from "../comp/core/TextArea";
import { ScrollPos } from "../comp/base/Comp";
import { FlexLayout } from "../comp/core/FlexLayout";
import { Tailwind } from "../Tailwind";

export class AISettingsView extends AppTab<any, AISettingsView> {
    maxWordsState: Validator = new Validator();
    temperatureState: Validator = new Validator();
    fileExtState: Validator = new Validator("");
    foldersToIncludeState: Validator = new Validator();
    foldersToExcludeState: Validator = new Validator();
    foldersToIncludeScrollPos = new ScrollPos();
    foldersToExcludeScrollPos = new ScrollPos();

    constructor(data: TabBase<any, AISettingsView>) {
        super(data);
        data.inst = this;
        this.fileExtState.setValue(getAs().userPrefs.aiAgentFileExtensions);
        this.foldersToIncludeState.setValue(getAs().userPrefs.aiAgentFoldersToInclude);
        this.foldersToExcludeState.setValue(getAs().userPrefs.aiAgentFoldersToExclude);
        this.maxWordsState.setValue("" + getAs().userPrefs.aiMaxWords);
        this.temperatureState.setValue("" + getAs().userPrefs.aiTemperature);
    }

    sectionTitle(title: string): Heading {
        return new Heading(6, title, { className: "settingsSectionTitle " + Tailwind.alertPrimary });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const horzClass = "mt-3 mb-3 settingsSection";
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
                        new Selection(null, "AI Service", aiOptions, "ml-6 mt-6 mb-6", {
                            setValue: (val: string) => S.edit.setAiService(val),
                            getValue: (): string => "" + getAs().userPrefs.aiService
                        }),
                        aiModelInfo ? new Div(aiModelInfo, { className: "ml-6" }) : null
                    ]),
                    new Div(null, { className: settingsCol }, [
                        ast.userProfile?.balance ? this.settingsLink("Credit: $" + ast.userProfile.balance?.toFixed(6), () => { }) : null,
                        S.quanta.config.paymentLink ?
                            new Button("Add Credit", S.user.addAccountCredit, null, "-primary settingsButton")
                            : new Span("paymentLink not configured"),
                    ])
                ], horzClass) : null,

                S.quanta.config.aiAgentEnabled ? //
                    new Div("AI Agent Configuration", {
                        className: "settingsSectionTitle " + Tailwind.alertPrimary
                    }) : null,
                S.quanta.config.aiAgentEnabled ? new Div(null, {
                    className: "mr-6"
                }, [
                    new TextArea("Folders to Include", {
                        rows: 4,
                        placeholder: "List folders to include (optional)"
                    }, this.foldersToIncludeState, null, false, 3, this.foldersToIncludeScrollPos),
                    new TextArea("Folders to Exclude", {
                        rows: 4,
                        placeholder: "List folders to exclude (optional)"
                    }, this.foldersToExcludeState, null, false, 3, this.foldersToExcludeScrollPos),
                    new TextField({
                        label: "File Extensions (ex: java,py,txt)", val: this.fileExtState,
                        outterClass: "mt-3"
                    }),
                ]) : null,
                new FlexLayout([
                    new TextField({
                        label: "Max Response Words",
                        val: this.maxWordsState,
                        inputClass: "maxResponseWords",
                        outterClass: "mt-3"
                    }),
                    new TextField({
                        label: "Creativity (0.0-1.0, Default=0.7)",
                        val: this.temperatureState,
                        inputClass: "aiTemperature",
                        outterClass: "ml-3 mt-3"
                    }),
                ]),
                new Button("Save", this._save, { className: "mt-6" })
            ])
        ];
        return true;
    }

    _save = async () => {
        await S.util.saveUserPrefs(s => {
            s.userPrefs.aiAgentFileExtensions = this.fileExtState.getValue();
            s.userPrefs.aiAgentFoldersToInclude = this.foldersToIncludeState.getValue();
            s.userPrefs.aiAgentFoldersToExclude = this.foldersToExcludeState.getValue();
            s.userPrefs.aiMaxWords = parseInt(this.maxWordsState.getValue());
            s.userPrefs.aiTemperature = parseFloat(this.temperatureState.getValue());
        });
        // flash confirmation message
        S.util.flashMessage("Saved settings", "Note");
    }

    settingsLink(name: string, onClick: () => void, moreClasses: string = ""): Div {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
