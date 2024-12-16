import { AppTab } from "../comp/AppTab";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Heading } from "../comp/core/Heading";
import { TabHeading } from "../comp/core/TabHeading";
import { SignupDlg } from "../dlg/SignupDlg";
import { TabBase } from "../intf/TabBase";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";

export class AdminView extends AppTab<any> {

    constructor(data: TabBase<any>) {
        super(data);
        data.inst = this;
    }

    sectionTitle(title: string): Heading {
        return new Heading(6, title, { className: "settingsSectionTitle " + Tailwind.alertPrimary });
    }

    override preRender(): boolean | null {
        const horzClass = "mt-3 mb-3 settingsSection";
        const settingsCol = "settingsCol";

        this.children = [
            this.headingBar = new TabHeading([
                new Div("Admin Console", { className: "tabTitle" })
            ], null),

            new Div(null, { className: "ml-3" }, [
                this.sectionTitle("Analytics"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        // /// new MenuItem("Backup DB", () => S.view.runServerCommand("BackupDb", "Backup DB Response", null, state)), //
                        this.settingsLink("Server Info", () => S.view.runServerCommand("getServerInfo", null, "Info View", null)), //
                        this.settingsLink("Performance Report", () => S.view.runServerCommand("performanceReport", null, "Performance Report", null)), //
                        this.settingsLink("Clear Performance Data", () => S.view.runServerCommand("clearPerformanceData", null, "Clear Performance Data", null)) //
                    ]),
                ], horzClass),

                this.sectionTitle("Testing"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Run JUnit Tests", () => S.view.runServerCommand("getTestResults", "run", "Test Results", null)),
                        this.settingsLink("Show Test Results", () => S.view.runServerCommand("getTestResults", null, "Test Results", null)),
                        this.settingsLink("Send Email", S.util._sendTestEmail),
                        this.settingsLink("Server Log Text", S.util._sendLogText),
                        this.settingsLink("Redis PubSub Test", () => S.view.runServerCommand("redisPubSubTest", null, "Redis PubSub Test", null)), //
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Notification Display", () => S.util.showSystemNotification("Test Title", "This is a test message")),

                        this.settingsLink("WebCrypto Encryption", async () => {
                            await S.crypto.encryptionTest();
                            S.util.showMessage("Crypto Test Complete. Check browser console for output.", "Note", true);
                        }),
                        this.settingsLink("Text to Speech", async () => {
                            const tts = window.speechSynthesis;
                            // /// let voices = tts.getVoices(); /// for (let i = 0; i <
                            // voices.length; i++) { ///     let voice = voices[i]; ///     //
                            // Google UK English Female (en-GB) ///     console.log("Voice: " +
                            // voice.name + " (" + voice.lang + ") " + (voice.default ? "<--
                            // Default" : ""));
                            // /// }

                            /* WARNING: speechSynthesis seems to crash very often and leave hung
                            processes, eating up CPU, at least on my Ubuntu 18.04, machine, so for
                            now any TTS development is on hold. */
                            const sayThis = new SpeechSynthesisUtterance("Wow. Browsers now support Text to Speech driven by JavaScript");
                            tts.speak(sayThis);
                        })
                    ])
                ], horzClass),

                this.sectionTitle("Utils"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Toggle Daemons", () => S.view.runServerCommand("toggleDaemons", null, "Toggle Daemons", null)), //
                        this.settingsLink("Toggle AuditFilter", () => S.view.runServerCommand("toggleAuditFilter", null, "Toggle AuditFilter", null)), //
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Create User", () => { new SignupDlg(true).open(); }), //
                        this.settingsLink("Refresh RSS Cache", () => S.view.runServerCommand("refreshRssCache", null, "Refresh RSS Cache", null)), //
                    ])
                ], horzClass),

                this.sectionTitle("Database"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Validate", () => S.view.runServerCommand("validateDb", null, "Validate DB Response", null)), //
                        this.settingsLink("Repair", () => S.view.runServerCommand("repairDb", null, "Repair DB Response", null)), //
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("DB Cleanup", () => S.view.runServerCommand("cleanupDb", null, "DB Cleanup Response", null)), //
                        // this.settingsLink("Run DB Conversion", () => S.view.runServerCommand("runConversion", null, "Run DB Conversion", null)), //
                        this.settingsLink("Rebuild Indexes", () => S.view.runServerCommand("rebuildIndexes", null, "Rebuild Indexes Response", null)), //
                    ])
                ], horzClass),
            ])
        ];
        return true;
    }

    settingsLink(name: string, onClick: () => void, moreClasses: string = ""): Div {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
