import { S } from "./Singletons";

declare let webkitSpeechRecognition: any;
declare let SpeechRecognition: any;

export class STT {
    // add type-safety here (TS can find type easily)
    recognition: any = null;

    speechActive: boolean = false;
    private callback: (text: string) => void;

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

    _stopListening = () => {
        // if never initialized just return
        if (!this.recognition) return;
        this.initRecognition();
        this.callback = null;
        this.recognition.stop();
        this.speechActive = false;
    }

    _startListening = () => {
        this.initRecognition();
        this.recognition.start();
        this.speechActive = true;
    }

    setListenerCallback = (callback: (val: string) => void) => {
        this.callback = callback;
    }
}
