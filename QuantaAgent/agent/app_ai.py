"""Makes a query to AI API and writes the response to a file."""

import os
from typing import Dict, List
from langchain.schema import HumanMessage, AIMessage, BaseMessage, SystemMessage
from langchain.chat_models.base import BaseChatModel
from langgraph.prebuilt import chat_agent_executor


from agent.models import TextBlock
from agent.utils import RefactorMode, Utils
from agent.tools.refactoring_tools import (
    UpdateBlockTool,
    CreateFileTool,
    UpdateFileTool
)
from common.python.file_utils import FileUtils

# The content of this class has been refactored out of exisitence except for one method so we need to just move it into the class that uses it, because
# it's only used in once place and it's not worth keeping it as a separate class
class AppAI:
    """Makes calls to AI"""

    dry_run: bool = False

    def __init__(
        self,
        mode: str,
        system_prompt: str,
        blocks: Dict[str, TextBlock] = {},
        source_folder: str = "",
        data_folder: str = "",
    ):
        self.mode = mode
        self.system_prompt: str = system_prompt
        self.blocks = blocks
        self.source_folder = source_folder
        self.data_folder = data_folder
        self.human_message = None
        self.input_prompt = None

    def query(
        self,
        ai_service: str,
        messages: List[BaseMessage],
        query: str,
        input_prompt: str,
        output_file_name: str,
        ts: str,
        temperature: float,
    ) -> str:
        """Makes a query to AI API and writes the response to a file."""
        ret: str = ""

        if self.dry_run:
            # If dry_run is True, we simulate the AI response by reading from a file
            # if we canfind that file or else we return a default response.
            answer_file: str = f"{self.data_folder}/dry-run-answer.txt"

            if os.path.isfile(answer_file):
                print(f"Simulating AI Response by reading answer from {answer_file}")
                ret = FileUtils.read_file(answer_file)
            else:
                ret = "Dry Run: No API call made."
        else:
            llm: BaseChatModel = Utils.create_llm(ai_service, temperature)

            # Check the first 'message' to see if it's a SystemMessage and if not then insert one
            if len(messages) == 0 or not isinstance(messages[0], SystemMessage):
                messages.insert(0, SystemMessage(content=self.system_prompt))
            # else we set the first message to the system prompt
            else:
                messages[0] = SystemMessage(content=self.system_prompt)

            self.human_message = HumanMessage(content=query)

            messages.append(self.human_message)

            if self.mode != RefactorMode.NONE.value:
                # https://python.langchain.com/v0.2/docs/tutorials/agents/
                tools = []

                if self.mode == RefactorMode.REFACTOR.value:
                    tools = [
                        UpdateBlockTool("Block Updater Tool", self.blocks),
                        CreateFileTool("File Creator Tool", self.source_folder),
                        UpdateFileTool("File Updater Tool", self.source_folder),
                    ]

                agent_executor = chat_agent_executor.create_tool_calling_executor(
                    llm, tools
                )
                initial_message_len = len(messages)
                response = agent_executor.invoke({"messages": list(messages)})
                # print(f"Response: {response}")
                resp_messages = response["messages"]
                new_messages = resp_messages[initial_message_len:]
                ret = ""
                ai_response: int = 0
                for message in new_messages:
                    if isinstance(message, AIMessage):
                        ai_response += 1
                        content = message.content
                        if not content:
                            content = Utils.get_tool_calls_str(message)
                            # print(f"TOOL CALLS:\n{content}")
                        ret += f"AI Response {ai_response}:\n{content}\n==============\n"  # type: ignore

                # Agents may add multiple new messages, so we need to update the messages list
                # This [:] syntax is a way to update the list in place
                messages[:] = resp_messages

            else:
                response = llm.invoke(list(messages))
                ret = response.content  # type: ignore
                messages.append(AIMessage(content=response.content))

        output = f"""AI Model Used: {ai_service}, Mode: {self.mode}, Timestamp: {ts}
____________________________________________________________________________________
Input Prompt: 
{input_prompt}
____________________________________________________________________________________
LLM Output: 
{ret}
____________________________________________________________________________________
System Prompt: 
{self.system_prompt}
____________________________________________________________________________________
Final Prompt: 
{query}
"""

        filename = f"{self.data_folder}/{output_file_name}.txt"
        FileUtils.write_file(filename, output)
        print(f"Wrote Log File: {filename}")
        return ret
