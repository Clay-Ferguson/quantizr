import { getAs } from "./AppContext";
import * as J from "./JavaIntf";
import { S } from "./Singletons";
import { Div } from "./comp/core/Div";
import { Span } from "./comp/core/Span";

export class AIService {
    name: string;
    description: string;
    longDescription: string;
}

export class AIUtil {
    aiServices: AIService[] = [];
    constructor() {
    }

    // #ai-model
    init() {
        this.aiServices = [];
        this.aiServices.push({
            name: J.AIModel.NONE,
            description: "none (inherit)",
            longDescription: ""
        });

        if (S.quanta.config.useOpenAi) {
            this.aiServices.push({
                name: J.AIModel.OPENAI,
                description: "OpenAI: ChatGPT-4o",
                longDescription: "A very powerful version of OpenAI's intelligent general-purpose AI (128K context)"
            });
            this.aiServices.push({
                name: J.AIModel.OPENAI_MINI,
                description: "OpenAI: ChatGPT-4o Mini",
                longDescription: "The less expensive version of OpenAI's intelligent general-purpose AI (128K context)"
            });
            // todo-2: Need to have a way to define in the configs which AI services are available. We have the code to support 'o1' models complete
            // and simply uncommenting these lines will fully enable it. However the requirement is an expendature of $1000 to gain access to these
            // models via the API as of October 2024, and Quanta.wiki has not yet qualified for that, so we have to disable these models for now.
            // this.aiServices.push({
            //     name: J.AIModel.OPENAI_O1_PREVIEW,
            //     description: "OpenAI: ChatGPT o1 Preview",
            //     longDescription: "The most powerful version of OpenAI's intelligent general-purpose AI, with reasoning capabilities (128K context)"
            // });
            // this.aiServices.push({
            //     name: J.AIModel.OPENAI_O1_MINI,
            //     description: "OpenAI: ChatGPT o1 Mini",
            //     longDescription: "The less expensive version of OpenAI's intelligent general-purpose AI, with reasoning capabilities (128K context)"
            // });
        }

        if (S.quanta.config.useGeminiAi) {
            this.aiServices.push({
                name: J.AIModel.GEMINI,
                description: "Google: Gemini 1.5 Pro",
                longDescription: "Google's best general-purpose AI (1 million context)"
            });
            this.aiServices.push({
                name: J.AIModel.GEMINI_FLASH,
                description: "Google: Gemini 1.5 Flash",
                longDescription: "Google's best cost effective general-purpose AI (2 million context)"
            });
        }

        if (S.quanta.config.usePplxAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.PPLX_LLAMA3,
                    description: "Meta: Llama 3",
                    longDescription: "Meta's Open Source Llama 3 (131K context)"
                });
        }

        if (S.quanta.config.useAnthAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.ANTH,
                    description: "Anthropic: Claude 3 Opus",
                    longDescription: "Anthropic's very powerful general-purpose AI (200K context)"
                },
                {
                    name: J.AIModel.ANTH_SONNET,
                    description: "Anthropic: Claude 3.5 Sonnet",
                    longDescription: "Anthropic's most powerful general-purpose AI (200K context)"
                });
        }

        if (S.quanta.config.usePplxAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.PPLX_CHAT,
                    description: "Perplexity: Basic",
                    longDescription: "Perplexity's best high-end powerful general-purpose AI (127K context)"
                },
                {
                    name: J.AIModel.PPLX_ONLINE,
                    description: "Perplexity: Recent News Aware",
                    longDescription: "Perplexity's AI which has access to the latest news and content from from the web (127K context)"
                });
        }
    }

    getActiveService(): AIService {
        return this.getServiceByName(getAs().userPrefs.aiService);
    }

    getServiceByName(name: string): AIService {
        if (!this.aiServices) return null;
        const ret = this.aiServices.find(ai => ai.name === name);
        if (!ret) {
            return this.aiServices[0];
        }
        return ret;
    }

    getAiNodeFooter(aiServiceDescript: string, node: J.NodeInfo): Div {
        if (!node) return null;
        return new Div(null, null, [
            new Span(S.util.formatDateTime(new Date(node.lastModified)), {
                className: "aiAnswerFooter"
            }),
            new Span(aiServiceDescript, {
                className: "aiAnswerFooter float-end"
            })
        ]);
    }

    getAiOptions(): AIService[] {
        const aiOptions = [];
        this.aiServices.forEach(ai => {
            aiOptions.push({ key: ai.name, val: ai.description });
        });
        return aiOptions;
    }
}