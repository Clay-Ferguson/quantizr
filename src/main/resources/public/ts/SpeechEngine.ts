import { S } from "./Singletons";
import { dispatch } from "./AppContext";

declare let webkitSpeechRecognition: any;
declare let SpeechRecognition: any;

export class SpeechEngine {
    queuedSpeech: string[] = null;

    // this is a guess (and recommendation from online sources) at how long a sentence we can get away with
    // and still avoid the Chrome bug which cuts off long sentences. If sentence is short enough we push the
    // whole thing
    MAX_UTTERANCE_CHARS: number = 200;

    recognition: any = null;
    tts: any = window.speechSynthesis;
    speechActive: boolean = false;
    private callback: (text: string) => void;

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
                setTimeout(() => {
                    this.recognition.start();
                }, 250);
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

    speakClipboard = async () => {
        if (!this.tts) return;
        // hack to be able to know NOW that we are running speech, so isSpeaking() is already correct.
        this.queuedSpeech = [];

        // const voices = window.speechSynthesis.getVoices();
        // need a config dialog that can open up a selection for voices, and speed of speech UX
        // voices?.forEach(voice => {
        //     console.log("Voice: " + voice.name + " (" + voice.lang + ") " + (voice.default ? "<-- Default" : ""));
        // });

        const clipTxt = await (navigator as any)?.clipboard?.readText();
        if (clipTxt) {
            this.speakText(clipTxt);
        }
        else {
            S.util.showMessage("Clipboard text not available.", "Warning");
        }
    }

    speakText = async (text: string) => {
        if (!this.tts || !text) return;

        dispatch("speechEngineStateChange", s => {
            s.speechPaused = false;
            s.speechSpeaking = true;
            return s;
        });

        // only becasue speech has had bugs over the years and one bug report I saw claimed putting the call
        // in a timeout helped, I'm doing that here, because I had a hunch this was best even before I saw someone
        // else make the claim.
        setTimeout(() => {
            this.tts.cancel();
            this.fragmentizeToQueue(text);

            this.queuedSpeech = this.queuedSpeech.filter(p => p.length > 0);
            if (this.queuedSpeech.length === 0) return;

            let idx = 0;
            let utter: any = null;
            const utterFunc = () => {
                if (!this.queuedSpeech) return;

                // If we have more stuff to speak
                if (idx < this.queuedSpeech.length) {
                    const sayThis = this.queuedSpeech[idx++];
                    S.domUtil.highlightBrowserText(sayThis);
                    utter = new SpeechSynthesisUtterance(sayThis);
                    utter.onend = utterFunc;

                    // NOTE: It's possible to submit multiple utterances, and the voice engine
                    // will queue them up and perform them. Not sure which is the best way to go
                    // and be sure to avoid overloading the speech engine with too much content, so for
                    // now we just submit one at a time, but the BEST approach is probably to que at least
                    // two at a time.
                    this.tts.speak(utter);
                }
                // If we're out of stuff to speak
                else {
                    this.queuedSpeech = null;
                    this.tts.cancel();
                    dispatch("speechEngineStateChange", s => {
                        s.speechPaused = false;
                        s.speechSpeaking = false;
                        return s;
                    });
                }
            };
            // Get started by uttering idx=0, and the rest of the sentences will follow
            // in a chin reaction every time utterFunc gets called via the 'onend' listener
            utterFunc();
        }, 100);
    }

    // The Chrome Speech engine will stop working unless you send it relatively short chunks of text,
    // and also feeding too much at once overloads it and causes a long delay before it can start speaking
    // wo we break the text into smaller chunks.
    fragmentizeToQueue = (text: string) => {
        this.queuedSpeech = [];

        // first split into sentences.
        const sentences = text.split(/[.!?\n\r]+/);

        // scan each sentence
        sentences?.forEach(sentence => {
            if (sentence.length < this.MAX_UTTERANCE_CHARS) {
                this.queuedSpeech.push(sentence);
            }
            // if sentence is too long get it's fragments
            else {
                const fragments = sentence.split(/[,;:]+/);
                let fragMerge = "";
                fragments?.forEach(frag => {
                    // todo-1: one final improvement here would be to check if 'frag' itself
                    // is longer than 300 chars, and if so break it up at separator words
                    // like "and", "but", "or", "however", etc..., but I haven't ever seen this be needed
                    // for for now the code is ok as is.

                    // if we can fit more onto the fragMerge then append.
                    if (fragMerge.length + frag.length < this.MAX_UTTERANCE_CHARS) {
                        fragMerge += frag;
                    }
                    else {
                        if (fragMerge) {
                            this.queuedSpeech.push(fragMerge);
                        }
                        fragMerge = frag;
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
    // states correct, because TRUST ME at least on Chrome the states are unreliable

    stopSpeaking = () => {
        if (!this.tts) return;
        this.queuedSpeech = null;
        this.tts.cancel();
        dispatch("speechEngineStateChange", s => {
            s.speechPaused = false;
            s.speechSpeaking = false;
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
