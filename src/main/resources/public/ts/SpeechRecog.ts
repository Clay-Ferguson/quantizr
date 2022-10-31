import { S } from "./Singletons";

declare let webkitSpeechRecognition: any;
declare let SpeechRecognition: any;

export class SpeechRecog {
    recognition: any = null;
    speechActive: boolean = false;
    private callback: (text: string) => void;

    init = () => {
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

    stop = () => {
        // if never initialized just return
        if (!this.recognition) return;
        this.init();
        this.recognition.stop();
        this.speechActive = false;
    }

    start = () => {
        this.init();
        this.recognition.start();
        this.speechActive = true;
    }

    setCallback = (callback: (val: string) => void) => {
        this.callback = callback;
    }
}
