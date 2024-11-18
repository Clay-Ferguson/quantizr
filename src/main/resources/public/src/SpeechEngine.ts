import { getAs, promiseDispatch } from "./AppContext";
import { Constants as C } from "./Constants";
import { S } from "./Singletons";
import { TTSView } from "./tabs/TTSView";

declare let webkitSpeechRecognition: any;
declare let SpeechRecognition: any;

export class SpeechEngine {
    // we keep this array here and not in AppState, because changes to this will never need to
    // directly trigger a DOM change.
    public queuedSpeech: string[] = null;

    public voices: SpeechSynthesisVoice[] = null;

    // this is a guess (and recommendation from online sources) at how long a sentence we can get
    // away with and still avoid the Chrome bug which cuts off long sentences. 
    // There's a tradeoff here where you can set a large number for
    // this (like well over 200), which causes the ttsTimer (below) to activate a lot which "i think"
    // can cause a slight speaker popping, --OR-- you can set this value to like 200, and the
    // popping will definitely not happen, but the sentence structure won't be perfect (meaning the
    // speaking voice may pause at awkward times every now and then)
    // (UPDATE: Seems to now run smoothly with 1000 chars, whereas 250 was what we used for a long time.)
    MAX_UTTERANCE_CHARS: number = 1000; //250

    // add type-safety here (TS can find type easily)
    recognition: any = null;

    tts: SpeechSynthesis = window.speechSynthesis;
    ttsTimer: any = null;
    ttsIdx: number = 0;

    // we need this to have instantly fast (independent of AppState) way to detect
    // if we are running speech. ttsRunning means it's actively speaking now.
    ttsRunning: boolean = false;
    ttsSpeakingTime: number = 0;
    utter: SpeechSynthesisUtterance = null;

    speechActive: boolean = false;
    private callback: (text: string) => void;

    constructor() {
        this.getVoices();
    }

    // --------------------------------------------------------------
    // Speech Recognition
    // --------------------------------------------------------------
    initRecognition() {
        // already initialized, then return
        if (this.recognition) return;

        if (typeof SpeechRecognition === "function") {
            this.recognition = new SpeechRecognition();
            // console.log("Speech recognition initialized (a).");
        }
        else if (webkitSpeechRecognition) {
            // todo-2: fix linter rule to make this cleaner (the first letter upper case is the issue here)
            const WebkitSpeechRecognition = webkitSpeechRecognition;
            this.recognition = new WebkitSpeechRecognition();
            // console.log("Speech recognition initialized (b).");
        }

        if (!this.recognition) {
            console.log("Speech recognition failed to initialize.");
            S.util.showMessage("Speech recognition not available in your browser.", "Warning");
            return;
        }

        this.recognition.lang = 'en-US';

        // This runs when the speech recognition service starts
        this.recognition.onstart = () => {
            // console.log("speech onStart.");
        };

        // This gets called basically at the end of every sentence as you're dictating content, and
        // paused between sentences, so we have to call start() again in here to start recording
        // another sentence
        this.recognition.onend = () => {
            // console.log("speech onEnd.");
            if (this.speechActive) {
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.error('Failed to restart recognition:', e);
                        this.speechActive = false;
                    }
                }, 500);  // Increased timeout
            }
        };

        this.recognition.onspeechend = () => {
            // console.log("speech onSpeechEnd.");
        };

        // This runs when the speech recognition service returns result
        this.recognition.onresult = (event: any) => {
            // console.log("speech onResult.");
            const transcript = event.results[0][0].transcript;
            // const confidence = event.results[0][0].confidence;

            if (this.callback) {
                this.callback(transcript);
            }
        };
    }

    stopListening() {
        // if never initialized just return
        if (!this.recognition) return;
        this.initRecognition();
        this.callback = null;
        this.recognition.stop();
        this.speechActive = false;
    }

    startListening() {
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

    // called directly by button on main top right corner.
    _speakClipboard = async () => {
        if (!this.tts) return;

        const clipTxt = await (navigator as any)?.clipboard?.readText();
        if (clipTxt) {
            this.speakText(clipTxt, true);
        }
        else {
            S.util.showMessage("Clipboard text not available.", "Warning");
        }
    }

    async speakText(text: string, selectTab: boolean = true, replayFromIdx: number = -1) {
        await this.stopSpeaking();
        setTimeout(() => {
            this.speakTextNow(text, selectTab, replayFromIdx);
        }, 1200);
    }

    async jumpToIdx(idx: number) {
        if (this.queuedSpeech?.length > 1 && idx >= 0 && idx < this.queuedSpeech?.length) {

            await this.stopSpeaking();
            this.highlightByIndex(idx);

            // Timeout to give the engine time to stop what it's doing. We could use PubSub, or a faster
            // polling to make this timer be a bit safer, in case 500ms isn't ok on slower machines.
            setTimeout(() => {
                this.speakTextNow(null, false, idx);
            }, 250);
        }
    }

    // you can pass null, and this method will repeat it's current text.
    async speakTextNow(text: string, selectTab: boolean = true, replayFromIdx: number = -1) {
        if (!this.tts || (!text && replayFromIdx === -1)) {
            console.log("TTS engine not available. Can't speak text.");
            return;
        }
        this.ttsRunning = true;
        this.createTtsTimer();

        if (selectTab) {
            S.tabUtil.selectTab(C.TAB_TTS);
        }

        // only because speech has had bugs over the years and one bug report I saw claimed putting
        // the call in a timeout helped, I'm doing that here, because I had a hunch this was best
        // even before I saw someone else make the claim.
        setTimeout(async () => {
            await this.getVoices();
            if (!this.voices || this.voices.length === 0) {
                console.warn("Voices not loaded. Can't speak text");
                return;
            }

            // Just use 0 idx if the one passed in is out of range somehow.
            if (replayFromIdx >= this.queuedSpeech?.length) {
                replayFromIdx = 0;
            }

            if (replayFromIdx === -1) {
                this.queuedSpeech = [];
                this.appendTextToBuffer(text);
                this.ttsIdx = 0;
            }
            else {
                this.ttsIdx = replayFromIdx;
            }

            promiseDispatch("speechEngineStateChange", s => {
                s.speechPaused = false;
                s.speechSpeaking = true;
                s.ttsRan = true;
            }).then(() => {
                this.queuedSpeech = this.queuedSpeech.filter(p => p.length > 0);

                if (this.queuedSpeech.length === 0) {
                    this.queuedSpeech = null;
                    console.log("No text to speak.");
                    return;
                }

                /* NOTE: This utterFunc gets used over and over in a daisy chain type way to process the
                next utterance every time the previous one completes. */
                const utterFunc = async () => {
                    console.log("utterFunc() called.");
                    if (!this.ttsRunning || !this.queuedSpeech) {
                        console.log("TTS not running. Stopping speaking.");
                        return;
                    }
                    const ast = getAs();

                    // If we're out of stuff to speak
                    if (this.ttsIdx >= this.queuedSpeech.length) {
                        await this.stopSpeaking();
                        console.log("No more text to speak.");
                        return;
                    }

                    // If we have more stuff to speak
                    if (this.ttsIdx < this.queuedSpeech.length) {
                        let sayThis = this.queuedSpeech[this.ttsIdx];

                        // if this is a paragraph break skip it, with idx++
                        while (sayThis === C.TTS_BREAK) {
                            // no more left?
                            if (++this.ttsIdx >= this.queuedSpeech.length) {
                                await this.stopSpeaking();
                                console.log("No more text to speak.");
                                return;
                            }

                            // keep going, with this sayThis.
                            sayThis = this.queuedSpeech[this.ttsIdx];
                        }

                        // Let's rip out all the hashtags and at symbols mainly just so we can read
                        // text full of hashtags and have it sound good.
                        sayThis = sayThis.replaceAll("#", " ");

                        // replace backquote or else the engine will pronounce the actual word 'backquote' which we of courose
                        // do not want.
                        sayThis = sayThis.replaceAll("`", "\"");
                        const utter = new SpeechSynthesisUtterance(sayThis);

                        if (ast.speechVoice >= 0) {
                            utter.voice = this.voices[ast.speechVoice < this.voices.length ? ast.speechVoice : 0];
                        }
                        else {
                            utter.voice = this.voices[0];
                        }

                        if (ast.speechRate) {
                            utter.rate = this.parseRateValue(ast.speechRate);
                        }

                        utter.volume = 1;

                        utter.onerror = (ev: SpeechSynthesisErrorEvent) => {
                            console.error("TTS error: " + ev.error);
                            this.ttsRunning = false;
                        }

                        utter.onend = () => {
                            console.log("Utterance ended.");
                            this.ttsSpeakingTime = 0;
                            this.utter = null;
                            if (!this.ttsRunning) return;
                            utterFunc();
                        }

                        if (!this.ttsRunning) {
                            console.log("TTS not running. Stopping speaking.");
                            return;
                        }
                        this.ttsSpeakingTime = 0;
                        this.utter = utter;
                        this.highlightByIndex(this.ttsIdx);
                        this.ttsIdx++;
                        console.log("Speaking this: " + sayThis);
                        this.tts.speak(utter);
                    }
                }
                this.ttsRunning = true;
                // Get started by uttering idx=0, and the rest of the sentences will follow in a
                // chain reaction every time utterFunc gets called via the 'onend' listener of the
                // most recently completed utterance
                utterFunc();
            });
        }, 100);
    }

    createTtsTimer() {
        // create timer that runs forever and fixes the Chrome bug whenever speech has been
        // running more than ten seconds.
        if (!this.ttsTimer) {
            const interval = 1000;
            // https://stackoverflow.com/questions/21947730/chrome-speech-synthesis-with-longer-texts
            this.ttsTimer = setInterval(() => {
                // const ast = getAs();
                // console.log("TTS STATE: paused=" + this.tts.paused + //
                //     " speaking=" + this.tts.speaking + " running=" + this.ttsRunning + " ast.paused=" + ast.speechPaused +
                //     " ast.speaking=" + ast.speechSpeaking);
                if (!this.ttsRunning) return;
                const ast = getAs();
                if (ast.speechSpeaking && !ast.speechPaused) {
                    this.ttsSpeakingTime += interval;
                    if (this.ttsSpeakingTime > 10000) {
                        this.ttsSpeakingTime = 0;

                        // todo-2: need to research this "fix" even more, because it appears even
                        // pausing for 10 seconds makes the TTS engine break, and if the only fix to
                        // that breaking is a resume again, that means we simply CANNOT use pause.
                        // Must stop and restart to simulate a pause
                        this.tts.pause();
                        this.tts.resume();
                    }
                }
            }, interval);
        }
    }

    highlightByIndex(idx: number) {
        TTSView.ttsHighlightIdx = idx;
        if (TTSView.inst) {
            TTSView.inst.mergeState({});
        }
    }

    parseRateValue(rate: string) {
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

    getVoices(): Promise<SpeechSynthesisVoice[]> {
        return new Promise((resolve) => {
            if (this.voices) {
                resolve(this.voices);
            } else {
                this.tts.onvoiceschanged = () => {
                    this.voices = this.tts.getVoices();
                    this.filterVoices();
                    resolve(this.voices);
                };
            }
        });
    }

    ttsSupported() {
        return this.tts && this.voices && this.voices.length > 0;
    }

    filterVoices() {
        // console.log("TTS: " + this.voices?.length + " voices.");

        // filter out voices that don't have english language
        this.voices = this.voices.filter(v => v.lang.startsWith("en"));

        for (const voice of this.voices) {
            console.log("    Voice: " + voice.name + " (" + voice.lang + ")");
        }
    }

    preProcessText = (text: string): string => {
        if (!text) return;
        // engine will SAY the 'quote' if you leave this here.
        text = text.replaceAll(".\"", ".");
        text = text.replaceAll(".'", ".");

        text = text.replaceAll("!\"", "!");
        text = text.replaceAll("!'", "!");

        text = text.replaceAll("?\"", "?");
        text = text.replaceAll("?'", "?");

        text = text.replaceAll(/[@#_*]/g, " ");
        return text;
    }

    fragmentText = (text: string, level: number): string[] => {
        const ret: string[] = [];
        const ast = getAs();
        const maxChars = this.MAX_UTTERANCE_CHARS * this.parseRateValue(ast.speechRate);
        if (text.length < maxChars) {
            ret.push(text);
            return ret;
        }

        let fragments = null;
        let lenCheck = 0;
        if (level === 0) {
            lenCheck = 2;
            fragments = text.split(/(?<=, )|(?=, )/);
        }
        else if (level === 1) {
            lenCheck = 14;
            // first split into 'words'. All things separated by spaces.
            fragments = text.split(/(?<= unless | until | which | but | nor | because | although | however | therefore | nevertheless | nonetheless )|(?= unless | until | which | but | nor | because | although | however | therefore | nevertheless | nonetheless )/);
        }
        else if (level === 2) {
            lenCheck = 4;
            fragments = text.split(/(?<= to | on | in )|(?= to | on | in )/);
        }
        else if (level === 3) {
            lenCheck = 5;
            fragments = text.split(/(?<= and | or | as | at | of )|(?= and | or | as | at | of )/);
        }

        // scan each word appendingn to frag until it gets too long and then
        // adding to ret
        let cachedWord = "";
        fragments?.forEach(fragment => {
            // this number must be the longest of all the split terms
            if (fragment.length <= lenCheck && fragment.trim().length > 1) {
                cachedWord = fragment;
                return;
            }
            if (cachedWord) {
                fragment = cachedWord + fragment;
                cachedWord = "";
            }

            if (fragment.length < maxChars) {
                // if this chunk and the last chunk can combine to be less than maxChars do it.
                if (ret.length > 0 && fragment.length + ret[ret.length - 1].length < maxChars) {
                    ret[ret.length - 1] += fragment;
                }
                else {
                    ret.push(fragment);
                }
            }
            else {
                if (level >= 3) {
                    ret.push(...this.fragmentBySpaces(fragment));
                }
                else {
                    ret.push(...this.fragmentText(fragment, level + 1));
                }
            }
        });

        if (cachedWord) {
            if (ret.length > 0) {
                ret[ret.length - 1] += cachedWord;
            }
            else {
                ret.push(cachedWord);
            }
        }

        return ret;
    }

    // as a last resort we just break string at spaces to create an array of unser MAX_UTTERANCE_CHARS
    // chunks of text.
    fragmentBySpaces = (text: string): string[] => {
        const ret: string[] = [];
        const ast = getAs();
        const maxChars = this.MAX_UTTERANCE_CHARS * this.parseRateValue(ast.speechRate);
        if (text.length < maxChars) {
            ret.push(text);
            return ret;
        }

        // first split into 'words'. All things separated by spaces.
        const words = text.split(/[ ]+/g);

        // scan each word appendingn to frag until it gets too long and then
        // adding to ret
        let frag = "";
        words?.forEach(word => {
            if (frag.length + word.length < maxChars) {
                frag += " " + word;
            }
            else {
                ret.push(frag);
                frag = word;
            }
        });

        if (frag.length > 0) {
            ret.push(frag);
        }
        return ret;
    }

    appendTextToBuffer(text: string) {
        if (!text) return;
        text = this.preProcessText(text);

        // first split into sentences.
        // 1) Match a single character present in [\n\r]
        // 2) '+' matches the previous token between one and unlimited times, as many
        //    times as possible, giving back as needed (greedy)
        const paragraphs = text.split(/[\n\r]+/g);

        paragraphs?.forEach(para => {
            if (para.length < 3) return;
            this.fragmentizeSentencesToQueue(para);

            // This is a harmless trick/hack where we avoid a significant complexity jump by doing
            // something slightly anti-patternish, but is good in this case, for now
            this.queuedSpeech.push(C.TTS_BREAK);
        });
    }

    // The Chrome Speech engine will stop working unless you send it relatively short chunks of
    // text. It's basically a time related thing where if it speaks for more than about 10 seconds
    // at a time it hangs. See the setInterval function in this class for more on the
    // tradeoffs/workarounds related to this.
    fragmentizeSentencesToQueue(text: string) {
        const ast = getAs();
        const maxChars = this.MAX_UTTERANCE_CHARS * this.parseRateValue(ast.speechRate);

        // This is a dirty but clever hack to fix lots of initials like (J.F.K.)
        // and make them not do any sentence breaks there.
        for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
            text = text.replaceAll(char + ".", char + " ");
        }

        const delimiterRegex = /([.!?;] +)/g;
        const sentences = text.split(delimiterRegex);

        // scan each sentence
        sentences?.forEach(sentence => {
            // Handle Punctuation
            // it's harmless to always tack on a single character to the most recent chunk, and
            // this IS how we get punctuation in at end of sentences (.!?;)
            // if (sentence.length === 1) {
            if (sentence.match(delimiterRegex)) {
                if (this.queuedSpeech.length > 0) {
                    this.queuedSpeech[this.queuedSpeech.length - 1] += sentence;
                    return;
                }
                // Yes right here, we fall thru and don't return. Not a bug. Don't want to loose any chars.
            }

            // if this sentence itself is short enough just add to queue
            if (sentence.length < maxChars) {
                this.queuedSpeech.push(sentence);
            }
            // Otherwise we have to break the sentence apart, so we break by commas first
            else {
                this.queuedSpeech = this.queuedSpeech.concat(this.fragmentText(sentence, 0));
            }
        });
    }

    // We manage 'paused & speaking' state ourselves rather than relying on the engine to have those
    // states correct, because TRUST ME at least on Chrome the states are unreliable. If you know
    // you're about to speak some new text you can pass in that text to update screen ASAP
    async stopSpeaking() {
        console.log("Stopping speaking.");
        if (!this.tts) return;
        this.ttsRunning = false;
        this.ttsSpeakingTime = 0;
        this.tts.cancel();

        await promiseDispatch("speechEngineStateChange", s => {
            s.speechPaused = false;
            s.speechSpeaking = false;
        });
    }

    // Using "tts.cancel()" instead of "tts.pause()" to work around Chrome Bug
    _pauseSpeaking = async () => {
        console.log("Pause speaking.");
        if (!this.tts) return;
        this.ttsRunning = false;
        this.tts.cancel();
        await promiseDispatch("speechEngineStateChange", s => {
            s.speechPaused = true;
        });
    }

    // Using "jumpToIdx()" instead of "tts.resume()" to work around Chrome Bug
    _resumeSpeaking = async () => {
        console.log("Resuming speaking.");
        // we use ttsIdx-1 as out starting point because this index is always kind of 'pre-advanced'
        // to the next utterance once a given utterance is stated.
        this.jumpToIdx(this.ttsIdx - 1);
    }

    // DO NOT DELETE:
    // These pauseSpeaking() and resumeSpeaking() functions works, until the "10 second Chrome Bug" but breaks
    // it again in chrome. So if Chrome ever fixes their bug these two methods will be able to work because they
    // ARE correct (if Chrome worked)
    // pauseSpeaking = async () => {
    //     if (!this.tts) return;
    //     this.ttsRunning = false;
    //     if (this.utter) {
    //         this.utter.volume = 0;
    //     }
    //     await promiseDispatch("speechEngineStateChange", s => {
    //         s.speechPaused = true;
    //     });
    //     this.tts.pause();
    // }
    // DO NOT DELETE:
    // resumeSpeaking = async () => {
    //     if (!this.tts) return;
    //     this.ttsRunning = true;
    //     if (this.utter) {
    //         this.utter.volume = 1;
    //     }
    //     await promiseDispatch("speechEngineStateChange", s => {
    //         s.speechPaused = false;
    //         s.speechSpeaking = true;
    //     });
    //     this.tts.resume();
    // }
}
