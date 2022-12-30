import { dispatch, getAppState, promiseDispatch, useAppState } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Heading } from "../comp/core/Heading";
import { Icon } from "../comp/core/Icon";
import { IconButton } from "../comp/core/IconButton";
import { Selection } from "../comp/core/Selection";
import { Span } from "../comp/core/Span";
import { Spinner } from "../comp/core/Spinner";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";

export class TTSView extends AppTab {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;

        // probably just need to move this logic into speech engine.
        const ast = getAppState();
        if (ast.speechVoice < 0) {
            const func = async () => {
                const voice = await S.localDB.getVal(C.LOCALDB_VOICE_INDEX, "allUsers");
                const rate = await S.localDB.getVal(C.LOCALDB_VOICE_RATE, "allUsers");
                promiseDispatch("Selecting Voice", (s) => {
                    s.speechVoice = voice || 0;
                    s.speechRate = rate || "normal";
                    return s;
                });
            }
            func();
        }
    }

    preRender(): void {
        const ast = useAppState();
        this.attribs.className = this.getClass(ast);

        const speakBtn = new IconButton("fa-volume-up", "Speak Clipboard", {
            onClick: () => S.speech.speakClipboard()
        }, "btn-primary", "off");

        // make the entire tab area a drop target for speaking text.
        S.domUtil.setDropHandler(this.attribs, (evt: DragEvent) => {
            for (const item of evt.dataTransfer.items) {
                // console.log("DROP(c) kind=" + item.kind + " type=" + item.type);
                if (item.kind === "string") {
                    item.getAsString(async (s) => S.speech.speakText(s));
                    return;
                }
            }
        });

        const speakAgainBtn = ast.ttsRan && S.speech.queuedSpeech?.length > 0 && !ast.mobileMode ? new Icon({
            className: "fa fa-refresh fa-lg marginRight clickable",
            onClick: () => S.speech.speakText(null, false, true),
            title: "Restart from the top"
        }) : null;

        const stopBtn = ast.speechSpeaking && !ast.mobileMode ? new Icon({
            className: "fa fa-stop fa-lg marginRight clickable",
            onClick: () => S.speech.stopSpeaking(),
            title: "Stop Speaking Text"
        }) : null;

        const pauseBtn = ast.speechSpeaking && !ast.speechPaused && !ast.mobileMode ? new Icon({
            className: "fa fa-pause fa-lg marginRight clickable",
            onClick: () => S.speech.pauseSpeaking(),
            title: "Pause Speaking Text"
        }) : null;

        const resumeBtn = ast.speechSpeaking && ast.speechPaused && !ast.mobileMode ? new Icon({
            className: "fa fa-play fa-lg marginRight clickable",
            onClick: () => S.speech.resumeSpeaking(),
            title: "Resume Speaking Text"
        }) : null;

        let heading = null;
        if (ast.speechSpeaking) {
            heading = "Speaking...";
        }
        else if (ast.speechPaused) {
            heading = "Speech Paused.";
        }
        else {
            heading = "Ready to Speak";
        }

        let paraComps: CompIntf[];
        if (S.speech.queuedSpeech?.length > 0) {
            paraComps = [];
            let curDiv = new Div(null, { className: "tts-paragraph" });

            let idx = 0;
            // scan each utterance
            S.speech.queuedSpeech.forEach(utter => {
                // if we hit a paragraph break
                if (utter === C.TTS_BREAK) {
                    if (curDiv.hasChildren()) {
                        paraComps.push(curDiv);
                    }
                    curDiv = new Div(null, { className: "tts-paragraph" });
                }
                else {
                    curDiv.addChild(new Span(utter, {
                        id: "tts" + idx,
                        className: "tts-span" + (S.speech.ttsHighlightIdx === idx ? " tts-hlt" : "")
                    }));
                }
                idx++;
            });

            if (curDiv.hasChildren()) {
                paraComps.push(curDiv);
            }
        }

        const content = paraComps ? paraComps : [new Spinner()];

        this.setChildren([
            new Div(null, { className: "headingBar" }, [
                new Div("Text-to-Speech", { className: "tabTitle" })
            ]),
            new Div("Drag-and-Drop text into this window to Speak It!", { className: "marginAll" }),
            new Div(null, { className: "float-end" }, [stopBtn, pauseBtn, resumeBtn, speakAgainBtn, speakBtn]),
            new FlexRowLayout([
                this.makeVoiceChooser(),
                this.makeRateChooser()
            ]),
            new Div(null, { className: "speech-text-area" }, [
                new Heading(4, heading, { className: "speech-area-title alert alert-primary" }),
                ...content
            ])
        ]);
    }

    makeVoiceChooser = (): Selection => {
        const data: any[] = [];
        let idx = 0;
        S.speech.getVoices()?.forEach(voice => {
            data.push({ key: "" + idx, val: voice.name + " " + voice.lang + (voice.default ? " -- DEFAULT" : "") });
            idx++;
        });

        return new Selection(null, "Voice", data, null, "selectVoiceDropDown", {
            setValue: (val: string) => {
                const voiceInt = parseInt(val);
                S.localDB.setVal(C.LOCALDB_VOICE_INDEX, voiceInt, "allUsers");
                dispatch("ChangeSpeechVoice", s => {
                    s.speechVoice = voiceInt;
                    return s;
                })
            },
            getValue: (): string => "" + getAppState().speechVoice
        });
    }

    makeRateChooser = (): Selection => {
        return new Selection(null, "Rate", [
            { key: "slowest", val: "Slowest" },
            { key: "slower", val: "Slower" },
            { key: "slow", val: "Slow" },
            { key: "normal", val: "Normal" },
            { key: "fast", val: "Fast" },
            { key: "faster", val: "Faster" },
            { key: "faster_1", val: "Faster +1" },
            { key: "fastest", val: "Fastest" }
        ], null, "rateChooserDropDown", {
            setValue: (val: string) => {
                S.localDB.setVal(C.LOCALDB_VOICE_RATE, val, "allUsers");
                dispatch("ChangeSpeechVoice", s => {
                    s.speechRate = val;
                    return s;
                })
            },
            getValue: (): string => getAppState().speechRate
        });
    }
}
