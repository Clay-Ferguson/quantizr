**[Quanta](/docs/index.md) / [Quanta User Guide](/docs/user-guide/index.md)**

* [Artificial Intelligence - LLMs](#artificial-intelligence---llms)
    * [AI Services Supported](#ai-services-supported)
        * [Anthropic](#anthropic)
        * [OpenAI](#openai)
        * [Perplexity](#perplexity)
        * [Google Gemini](#google-gemini)
    * [AI Conversations](#ai-conversations)
    * [A Node that Asks a Question to AI](#a-node-that-asks-a-question-to-ai)
    * [Asking Questions to the AI](#asking-questions-to-the-ai)
    * [Questions about a Subgraph](#questions-about-a-subgraph)
    * [Configure AI](#configure-ai)
        * [System Prompt Examples](#system-prompt-examples)
    * [Image Understanding](#image-understanding)
    * [Image Generation](#image-generation)
    * [Speech Generation](#speech-generation)
    * [AI Service Selection](#ai-service-selection)
        * [AI Services Supported](#ai-services-supported)
    * [Practical Use Case Example - Writing a Scientific Paper](#practical-use-case-example---writing-a-scientific-paper)
        * [Configure Document Root Node to have AI Settings](#configure-document-root-node-to-have-ai-settings)
        * [Generating AI Content in your Documents](#generating-ai-content-in-your-documents)

# Artificial Intelligence - LLMs

Converse with AI, generate images, ask questions about images, generate speech MP3s from text.

Interact with AI by asking questions and getting answers automatically saved into your tree. The AI can assist you with almost any kind of task, or help you improve your written content, and it retains a contextual memory of all conversations, by using the tree location as "context".

When you ask a question to the AI you'll automatically be switched over to the `Thread View` tab so you can see the current AI conversation thread all in a simple chronological view, and ask follow up questions, in an "AI Chat". See the [Thread View User Guide Section](/docs/user-guide/thread-view/index.md) for more on how the Thread View itself works.

# AI Services Supported

By a selection in your account in `Menu -> Account -> Settings -> AI -> AI Service` you can choose which AI Service to use in your account. You can choose OpenAI, Gemini, or Perplexity.

If you're doing image recognition, image generation, or speech generation, you can only use the "OpenAI" Service, but if you're doing purely conversational AI where you're having a conversation with an AI Chatbot then you can use any of the three services.

## Anthropic

Including both **Sonnet** (best combination of performance and speed), and **Opus** (most intelligent and advanced model) Chat models.

<img src='attachments/65f1f0fbe1bcaf0c420fca43-anthropic.png' style='width:20%'/>


## OpenAI

Including Chat Model, Text to Image (Image Generation), Image Understand, Text to Speech (Speech to MP3 Generation)

<img src='attachments/65c5a9043e8c3b6aec82835c-file-p' style='width:20%'/>


## Perplexity

Including Chat Model, Online Model (news aware), Code Llama, Llama 2

<img src='attachments/65c5a91a3e8c3b6aec82835d-file-p' style='width:20%'/>


## Google Gemini

Includes google's new chat model, for interactive chats.

<img src='attachments/65c5a9543e8c3b6aec82835e-file-p' style='width:20%'/>


Everything in Quanta is offered for free except for AI Capabilities. Since AI is provided by [OpenAI](https://openai.com) and their services cost money, Quanta lets you use your own credit, which you can add to you account, by going to `Menu -> Account -> Settings -> Add Credit` to use your Credit Card to add funds directly to your own account. Add as much credit as you want, but even one $1 buys quite a lot of AI generated content, so add as little or as much funds to your account as you want.

**Use Quanta AI to...**

* Get answers to general questions about anything
* Have conversations with the AI, that you can either keep private or share publicly
* Ask questions about the content of any Quanta tree branch
* Generate images via text prompt
* Ask questions about images
* Generate Speech from text, and save as MP3 attachment

# AI Conversations

The screenshot below shows how to ask a question to the AI, and get it's answer back. `Answers` are always inserted as a new node directly under the `question` node. This means AI conversations are actually a tree and not a top-to-bottom list.

<img src='attachments/6591ebdbc9873822b24fa632-file-p' style='width:100%'/>


# A Node that Asks a Question to AI

The screenshot below shows the easiest way to ask the AI a question. You just type your question and click the `Ask GPT` button. The answer to the node content will be inserted as a subnode directly under the node containing the question.

![file-p](attachments/64f9194706a5b22fcf32ed0d-file-p)


# Asking Questions to the AI

You can ask questions to ChatGPT, and it's answer will be saved as a subnode under the question node. This means you can have a more `hierarchical` way of chatting with the AI, than what most chat systems provide, where any location in this hierarchy has it's own unique "context". 

By "context" we simply mean the AI knows exactly what has been previously said during any conversation, and will resume talking to you at any point starting with that specific set of "memories" in it's "mind".

In other words, if you're having a conversation (i.e. asking questions) and go back up the tree to a higher location in the conversation thread, and ask a new question under one of those 'nodes', that's like rolling back the mind of the AI to the exact state it had at that point in the conversation; and it will answer the new question based on that state of mind.

Once you've gotten an answer back from the AI, you can then select the answer node, and create another question node under it using the same process, to continue with the conversation (i.e. asking more questions).

You can keep asking more follow-up questions as long as you want, and that will just extend the length of that "conversation branch" under the tree. You can of course go back to any location in the tree and ask a different follow-up question and you will get an answer equivalent to if you had rolled-back the "memory" of the AI back to that point in time. 

This memory of the conversation state is called Hierarchical Contextual Memory (HCM). Stated another way, we could say that the "context" (the AI's memory and understanding of the conversation) for any question always includes all "parent nodes" at higher levels up in the tree, going back to when you asked your original question.

# Questions about a Subgraph

Use `Menu -> AI -> Ask about Subgraph` to open a text entry box where you can enter a question (to be answered by AI) about the content under the selected branch of the tree. In other words you can select a node that is at the top level of whatever you want to ask questions about, and then click this menu item.

The term *subgraph*, of course means just "everything under that branch". All of the text under that subgraph will be used as the context information fed to the AI for it to be able to answer the question with, in addition to all it's built-in knowledge.

If you only want to ask an AI question about a limited subset of nodes you can use the checkboxes on each node (when `Edit Mode` is enabled) to select one or more nodes and this will cause the subgraph to be filtered to only included your selected nodes as input context to the AI.

# Configure AI

Use `Menu -> AI -> Configure AI` to configure a node (any node), so that all questions anywhere on the tree under that node will have the prompt settings you specify. The technical term for these instructions is called the `System Prompt`. All it really means is that you can describe a `role` for the AI to assume during it's answers. 

*NOTE: Most of the discussion below describes how 'System Prompt' works for the OpenAI LLM, however when System Prompt is used with Anthropic Models (Sonnet and Opus), the System Prompt is simply added as a prefix to the actual prompt/question, because Anthropic doesn't support System Prompt per se.* 

In other words you can say things like the following examples and the AI will assume this role during all question answering you do anywhere in the subgraph under this node. Once you set this `System Prompt` on the node it gets saved but it doesn't appear on the screen until you come back to the Configure GPT dialog to edit/view it again. 

**Example System Prompts:**

* You are a pirate, and will answer all questions like a pirate.

* You are an expert physicist and research assistant helping me write a paper on a discovery in Quantum Mechanics

* We are playing an adding game, and you will simply just sum up all the numbers you've ever seen and respond with the result.

NOTE: Experimenting with that adding game is the simplest way to make sure you understand how this, because you can just enter a few numbers into some nodes and not matter what question you ask you should always see it obeys it's system prompt and just replies with the total of all numbers it encountered, since that was it's explicit instructions

![file-p](attachments/65b6b364e6d38a174f58684d-file-p)


So we would first click a node on the tree, and then choose `Menu -> AI -> Configure AI` to open the dialog above. After clicking "Save" in the dialog it will store these settings onto the selected node, so that all future questions asked below that section of the tree (anywhere under that branch of the tree) will `cause GPT to answer as a pirate`. Pirates are a fun role to let the GPT play, because they start sentences with `"Hey matey, how arrrr ye."` etc.

*Tip: When you use a prompt that start with "You will...", or "You are..." or some sentence starting with "you", or when you use the word "you" in any sentence at all in this prompt the AI knows you're talking to it. You speak to it (the AI) basically the same way you would speak to a person.

## System Prompt Examples

Here are some other examples to give you an idea of just how flexible and intelligent the AI is at assuming various roles. The `System Prompt` is where you tell the AI what role it is going to play in the discussion. Here are some more examples:

* You are a helpful assistant. *(This is the default System Prompt if one is not specified)*

* Summarize content you are provided with for a second-grade student.

* You will be provided with a piece of code, and your task is to explain it in a concise way.

* You will be provided with a block of text, and your task is to extract a list of keywords from it.

* Create a Python function from a specification.

* You will be provided with a sentence in English, and your task is to translate it into French.

* Convert natural language into SQL queries.

# Image Understanding

To use GPT-4 Vision, simply upload an image onto the node, then paste a question into the node and click the AI Button (Robot Icon).

Here's an example asking questions about an image of an air conditioner unit. When you ask a question in a node that has an image attached the AI automatically assumes you're asking a question about the image itself.

<img src='attachments/654ab0d182df4f62995973fd-question-about-image.gif' style='width:100%'/>


# Image Generation

To generate images with DALL-E 3, click the upload button, then specify that you want an AI Generated image, and then type a description.

<img src='attachments/654ab18182df4f629959741c-bird-house-hunting.gif' style='width:100%'/>


# Speech Generation

To convert a body of text to an MP3 file of a person narrating the text, you can do that using the "Attach" button, to attach the MP3.

In the screen recording below we generate an MP3 file and attaching it to the node. The GIF is silent or else you would be able to hear the sentence being read when the created MP3 was played right.

<img src='attachments/6591e76fc9873822b24fa51c-ai-text-to-speech.gif' style='width:100%'/>


# AI Service Selection

Quanta can connect to several different AI APIs on the back end, which is what performs the actual AI services. Any time you ask the AI a question it goes to your currently active Service. You can change what service you want to use any time using the selection in your Account Settings at `Menu -> Account -> Settings -> AI Service`, as shown in the following image:

<img src='attachments/65bc2b7bcf425c5fe6f2dde2-file-p' style='width:100%'/>


## AI Services Supported

No matter what AI service you use, you will be charged only exactly what you consume based on OpenAI and/or Perplexity's pricing models. Quanta doesn't charge extra for use of AI, but merely passes your costs thru without any markup.

----

Here's the list of the available AI Services:

| AI Service Name     | Description                                                                       |
|---------------------|-----------------------------------------------------------------------------------|
| **Opus (Anthropic Claud 3)** |  Anthropic's most intelligent model, which can handle complex analysis, longer tasks with multiple steps, and higher-order math and coding tasks. |
| **Sonnet (Anthropic Claud 3)** | Anthropic's best combination of performance and speed for efficient, high-throughput tasks. |
| **OpenAI (Chat)**   | ChatGPT-4, the default chatbot and is widely considered the most intelligent general-purpose AI on the market. |
| **Google Gemini (Chat)** | Google's best high-end powerful general-purpose AI.                        |
| **Perplexity (Chat)** | Perplexity's best high-end powerful general-purpose AI.                    |
| **Perplexity (Recent News)** | Perplexity's AI which has access to the latest news and content from the web. |
| **Code Llama**      | The well-known open source Code Llama, which is great for coding and programming tasks. |
| **Llama 2**         | The well-known open source Llama 2, which is great for general-purpose tasks. |

# Practical Use Case Example - Writing a Scientific Paper
----

Let's say you're writing a research paper, and you want to get AI assistance with your writing.

In this scenario you would first create the top level "root" of your document on the content tree. You would call it something like `"A Unification Theory: Schrodinger Black Holes"` or whatever. So all your sections, and paragraphs and content will go under that node as a large subgraph representing your document.

## Configure Document Root Node to have AI Settings

You would then select that document root node and click `Menu -> AI -> Configure AI` settings and enter into that dialog something like the following: 

**System Prompt:**

`"You are a theoretical physics researcher and scientist helping me write a research paper. You will take the text I provide, and rewrite it to make it better."`

The above system prompt at the root of the document gives the AI the ability to apply that system prompt across the entire document as you start generating AI content underneath.

## Generating AI Content in your Documents

Now let's say your're editing in this document (i.e. creating/modifying nodes under your document rood node), and you want to generate a paragraph of text for the document using AI.

The quickest way to get a piece of AI generated content is to create a node that contains your AI query prompt as its content and then click the AI button (Robot button at the bottom of the editor) to ask the question. This will insert the AI-generated answer to the question as a subnode under the question node.

However in this case you've created a node that will be sitting in your document that is an actual question with an answer under it, and that is different from what you would want to see in an actual document about some specific topic.

So if there is a place in your document where you would like to insert some content, that is AI generated, as if it was a piece of the document itself there is a way to do that as well. In this case, what you'd do is configure a node so that it has the description of the content (an AI prompt/question) you like to create as part of the actual node configuration itself.

Let's show an example so that this makes sense. Let's say you're writing a document on something related to Quantum Mechanics and you want to include an AI Generated paragraph or two on the actual definition of QM.

You'd simply create an empty node at that location in your document and again choose `Menu -> AI -> Configure AI`, and then enter the following template:

![file-p](attachments/65d6ef79d711a216791d9556-file-p)


Note the checkbox `Overwrite Content with Answer`. This means that whenever you click the `AI Generate` button (the robot icon) at the bottom of the editor for this node, the current content of that node will be overwritten with the response from the selected `AI Service` using the output from the `Query Template`.

Once you've configured the AI settings to be what's shown above you can then click the said robot icon and it will query the AI and then inject the definition of "Quantum Mechanics" into the content of that node. Using this technique you can create documents that seamlessly contain chunks of content that are AI-Generated mixed in with your own words.

**[ChatGPT Example Q&A](/docs/user-guide/addendum/index.md)**


----
**[Next: Content Layout](/docs/user-guide/page-layout/index.md)**
