import { S } from "./Singletons";
import { dispatch, getAppState, promiseDispatch } from "./AppContext";
import { Constants as C } from "./Constants";

declare let webkitSpeechRecognition: any;
declare let SpeechRecognition: any;

export class SpeechEngine {
    queuedSpeech: string[] = null;
    private voices: SpeechSynthesisVoice[] = null;

    // this is a guess (and recommendation from online sources) at how long a sentence we can get away with
    // and still avoid the Chrome bug which cuts off long sentences. If sentence is short enough we push the
    // whole thing. There's a tradeoff here where you can set a large number for this (like well over 200), which causes
    // the ttsTimer (below) to activate a lot with "i think" can cause a slight speaker popping, --OR-- you can set this
    // value to like 200, and the popping will definitely not happen, but the sentence structure won't be perfect (meaning
    // the speaking voice may pause at awkward times every now and then)
    MAX_UTTERANCE_CHARS: number = 300;

    // add type-safety here (TS can find type easily)
    recognition: any = null;

    tts: SpeechSynthesis = window.speechSynthesis;
    ttsTimer: any = null;
    ttsSpeakingTime: number = 0;
    utter: SpeechSynthesisUtterance = null;
    speechActive: boolean = false;
    private callback: (text: string) => void;

    constructor() {

        // todo-0: put this in a function called 'initVoices'
        const interval = setInterval(() => {
            this.getVoices();
            if (this.voices) {
                clearInterval(interval);
                console.log("tts loaded " + this.voices.length + " voices");
            }
            else {
                console.log("can't get voices yet from tts. Still trying.");
            }
        }, 1000);
    }

    // --------------------------------------------------------------
    // Speech Recognition
    // --------------------------------------------------------------

    initRecognition = () => {
        // already initialized, then return
        if (this.recognition) return;

        if (typeof SpeechRecognition === "function") {
            this.recognition = new SpeechRecognition();
        }
        else if (webkitSpeechRecognition) {
            // todo-2: fix linter rule to make this cleaner (the first letter upper case is the issue here)
            const WebkitSpeechRecognition = webkitSpeechRecognition;
            this.recognition = new WebkitSpeechRecognition();
        }

        if (!this.recognition) {
            S.util.showMessage("Speech recognition not available in your browser.", "Warning");
            return;
        }

        // This runs when the speech recognition service starts
        this.recognition.onstart = () => {
            // console.log("speech onStart.");
        };

        // This gets called basically at the end of every sentence as you're dictating content,
        // and paused between sentences, so we have to call start() again in here to start recording
        // another sentence
        this.recognition.onend = () => {
            // console.log("speech onEnd.");
            if (this.speechActive) {
                // todo-0: this was a bug. Check for similar bugs there you have "() => functionName" because that
                // won't call the function
                setTimeout(this.recognition.start, 250);
            }
        };

        this.recognition.onspeechend = () => {
            // console.log("speech onSpeechEnd.");
        };

        // This runs when the speech recognition service returns result
        this.recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            // const confidence = event.results[0][0].confidence;

            if (this.callback) {
                this.callback(transcript);
            }
        };
    }

    stopListening = () => {
        // if never initialized just return
        if (!this.recognition) return;
        this.initRecognition();
        this.recognition.stop();
        this.speechActive = false;
    }

    startListening = () => {
        this.initRecognition();
        this.recognition.start();
        this.speechActive = true;
    }

    setListenerCallback = (callback: (val: string) => void) => {
        this.callback = callback;
    }

    // --------------------------------------------------------------
    // Text to Speech
    // --------------------------------------------------------------

    speakSelOrClipboard = () => {
        const sel = window.getSelection().toString();
        if (sel) {
            // when speaking our selected text we pass false so tab doesn't chagne.
            this.speakText(sel, false);
        }
        else {
            this.speakClipboard();
        }
    }

    speakClipboard = async () => {
        if (!this.tts) return;
        // hack to be able to know NOW that we are running speech, so isSpeaking() is already correct.
        this.queuedSpeech = [];

        const clipTxt = await (navigator as any)?.clipboard?.readText();
        if (clipTxt) {
            this.speakText(clipTxt);
        }
        else {
            S.util.showMessage("Clipboard text not available.", "Warning");
        }
    }

    speakText = async (text: string, selectTab: boolean = true) => {
        const ast = getAppState();

        // if currently speaking we need to shut down and wait 1200ms before trying to speak again,
        // but it would be better to use a listener or something to know precisely when it's ready
        // to start speaking again.
        if (ast.speechSpeaking) {
            this.stopSpeaking(text);
            setTimeout(() => {
                this.speakTextNow(text, selectTab);
            }, 1200);
        }
        else {
            this.speakTextNow(text, selectTab);
        }
    }

    // you can pass null, and this method will repeat it's current text.
    speakTextNow = async (text: string, selectTab: boolean = true) => {
        if (!this.tts || !text) return;

        const interval = 1000;

        // create timer that runs forever and fixes the Chrome bug whenever speech has been
        // running more than ten seconds.
        if (!this.ttsTimer) {
            // https://stackoverflow.com/questions/21947730/chrome-speech-synthesis-with-longer-texts
            this.ttsTimer = setInterval(() => {
                if (getAppState().speechSpeaking) {
                    this.ttsSpeakingTime += interval;
                    if (this.ttsSpeakingTime > 10000) {
                        this.ttsSpeakingTime = 0;
                        this.tts.pause();
                        this.tts.resume();
                    }
                }
            }, interval);
        }

        await promiseDispatch("speechEngineStateChange", s => {
            s.speechText = text;
            s.speechPaused = false;
            s.speechSpeaking = true;
            s.ttsRan = true;
            return s;
        });

        if (selectTab) {
            S.tabUtil.selectTab(C.TAB_TTS);
        }

        // only becasue speech has had bugs over the years and one bug report I saw claimed putting the call
        // in a timeout helped, I'm doing that here, because I had a hunch this was best even before I saw someone
        // else make the claim.
        setTimeout(() => {
            this.getVoices();
            if (!this.voices) {
                console.warn("Voices not loaded. Can't speak text");
                return;
            }

            text = this.preProcessText(text);
            this.queuedSpeech = [];
            this.fragmentizeToQueue(text);

            this.queuedSpeech = this.queuedSpeech.filter(p => p.length > 0);
            if (this.queuedSpeech.length === 0) return;

            let idx = 0;
            let utter: SpeechSynthesisUtterance = null;
            const utterFunc = () => {
                const ast = getAppState();
                if (!this.queuedSpeech) return;

                // If we're out of stuff to speak
                if (idx >= this.queuedSpeech.length) {
                    this.queuedSpeech = null;
                    this.ttsSpeakingTime = 0;
                    this.tts.cancel();
                    dispatch("speechEngineStateChange", s => {
                        s.speechPaused = false;
                        s.speechSpeaking = false;
                        return s;
                    });
                    return;
                }

                // If we have more stuff to speak
                if (idx < this.queuedSpeech.length) {
                    const sayThis = this.queuedSpeech[idx];

                    // This can jump over to the Highlight panel, and also now that we have
                    // the option to Speak the acuall hilighted text on the page we will need
                    // some other way if we want to try to indicate to the user what's being read
                    // in realtime.
                    // todo-0: Here's the solution. We can already generate one div
                    // S.domUtil.highlightBrowserText(sayThis);

                    utter = new SpeechSynthesisUtterance(sayThis);

                    if (ast.speechVoice >= 0) {
                        const voices = this.getVoices();
                        utter.voice = voices[ast.speechVoice < voices.length ? ast.speechVoice : 0];
                    }
                    if (ast.speechRate) {
                        utter.rate = this.parseRateValue(ast.speechRate);
                    }

                    utter.onend = () => {
                        this.ttsSpeakingTime = 0;
                        this.utter = null;
                        utterFunc();
                    }
                    // console.log("SPEAK[" + sayThis.length + "]: " + sayThis);
                    idx++;
                    this.ttsSpeakingTime = 0;
                    this.utter = utter;
                    this.tts.speak(utter);
                }
            };
            // Get started by uttering idx=0, and the rest of the sentences will follow
            // in a chain reaction every time utterFunc gets called via the 'onend' listener
            utterFunc();
        }, 100);
    }

    parseRateValue = (rate: string) => {
        switch (rate) {
            case "slowest":
                return 0.7;
            case "slower":
                return 0.8;
            case "slow":
                return 0.9;
            case "normal":
                return 1;
            case "fast":
                return 1.1;
            case "faster":
                return 1.2;
            case "faster_1":
                return 1.3;
            case "fastest":
                return 1.4;
            default:
                return 1;
        }
    }

    getVoices = () => {
        if (this.voices) return this.voices;
        this.voices = this.tts.getVoices();
    }

    preProcessText = (text: string): string => {
        // engine will SAY the 'quote' if you leave this here.
        text = text.replaceAll(".\"", ".");
        text = text.replaceAll(".'", ".");

        text = text.replaceAll("!\"", "!");
        text = text.replaceAll("!'", "!");

        text = text.replaceAll("?\"", "?");
        text = text.replaceAll("?'", "?");

        // need to create a list to iterate thru for these.
        text = text.replaceAll("Rep.", "Rep");
        text = text.replaceAll("D.C.", "DC");
        text = text.replaceAll("U.S.", "US");

        return text;
    }

    // as a last resort we just break string at spaces to create an array of unser MAX_UTTERANCE_CHARS
    // chunks of text
    fragmentBySpaces = (text: string): string[] => {
        const ret: string[] = [];
        const ast = getAppState();
        const maxChars = this.MAX_UTTERANCE_CHARS * this.parseRateValue(ast.speechRate);

        // first split into sentences.
        const words = text.split(/[ ]+/);

        // scan each word appendingn to frag until it gets too long and then
        // adding to ret
        let frag = "";
        words?.forEach(word => {
            if (frag.length + word.length < maxChars) {
                frag += " " + word;
            }
            else {
                ret.push(frag.trim());
                frag = word;
            }
        });

        if (frag.length > 0) {
            ret.push(frag.trim());
        }

        return ret;
    }

    fragmentizeToQueue = (text: string) => {
        const ast = getAppState();
        const maxChars = this.MAX_UTTERANCE_CHARS * this.parseRateValue(ast.speechRate);

        // first split into sentences.
        // todo-0: need to review the '+' in this REGEX and fully understand that.
        const paragraphs = text.split(/[\n\r]+/);

        // todo-0: verify that this works on text with NO newlines. It should.
        paragraphs?.forEach(para => {
            // if entire paragraph can fit
            if (para.length < maxChars) {
                this.queuedSpeech.push(para);
            }
            else {
                this.fragmentizeSentencesToQueue(para);
            }
        });
    }

    // The Chrome Speech engine will stop working unless you send it relatively short chunks of text. It's basically
    // a time related thing where if it speaks for more than about 10 seconds at a time it hangs.
    //
    // todo-0: Currently we're loosing the punctuation when we can add the entire sentence and there is a way to use
    // REGEX that includes the delimiters.
    fragmentizeSentencesToQueue = (text: string) => {
        const ast = getAppState();
        const maxChars = this.MAX_UTTERANCE_CHARS * this.parseRateValue(ast.speechRate);

        // This is a dirty but clever hack to fix lots of initials like (J.F.K., or even John F. Kennedy)
        // and make them not do any sentence breaks there.
        for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
            text = text.replaceAll(char + ".", char + " ");
        }

        // first split into sentences.
        const sentences = text.split(/[.!?]+/);

        // scan each sentence
        sentences?.forEach(sentence => {
            // if this sentence itself is short enough just add to queue
            if (sentence.length < maxChars) {
                this.queuedSpeech.push(sentence);
            }
            // Otherwise we have to break the sentence apart.
            else {
                const fragments = sentence.split(/[,;]+/);
                let fragMerge = "";
                fragments?.forEach(frag => {
                    // if we can fit more onto the fragMerge then append.
                    if (fragMerge.length + frag.length < maxChars) {
                        fragMerge += frag;
                    }
                    // if frag is short enough to make the new fragMerge do that.
                    else if (frag.length < maxChars) {
                        if (fragMerge) {
                            this.queuedSpeech.push(fragMerge);
                        }
                        fragMerge = frag;
                    }
                    // else 'frag' would would make fragMerge too large, so we commit the current
                    // fragMerge to the queue, first, and then queue by breaking the sentence by words.
                    else {
                        if (fragMerge) {
                            this.queuedSpeech.push(fragMerge);
                        }
                        fragMerge = "";
                        this.queuedSpeech = this.queuedSpeech.concat(this.fragmentBySpaces(frag));
                    }
                });

                // push whatever was left.
                if (fragMerge) {
                    this.queuedSpeech.push(fragMerge);
                }
            }
        });
    }

    // We manage 'paused & speaking' state ourselves rather than relying on the engine to have those
    // states correct, because TRUST ME at least on Chrome the states are unreliable.
    // If you know you're about to speak some new text you can pass in that text to update screen ASAP
    stopSpeaking = (nextText?: string) => {
        if (!this.tts) return;
        this.queuedSpeech = null;
        this.ttsSpeakingTime = 0;
        this.tts.cancel();
        dispatch("speechEngineStateChange", s => {
            s.speechPaused = false;
            s.speechSpeaking = false;
            if (nextText) {
                s.speechText = nextText;
            }
            return s;
        });
    }

    pauseSpeaking = () => {
        if (!this.tts) return;
        this.tts.pause();
        dispatch("speechEngineStateChange", s => {
            s.speechPaused = true;
            s.speechSpeaking = true;
            return s;
        });
    }

    resumeSpeaking = () => {
        if (!this.tts) return;
        this.tts.resume();
        dispatch("speechEngineStateChange", s => {
            s.speechPaused = false;
            s.speechSpeaking = true;
            return s;
        });
    }
}
