import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import "dotenv/config";
import { getHistory, saveToHistory } from './memory';

///
/// Run command is npx ts-node index.ts
///
export async function callAgent(query: string) {
  try {
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
    });

    // 🌐 Web Search Tool using Tavily
    const tavily = new TavilySearchResults({
      apiKey: process.env.TAVILY_API_KEY!,
    });

    const tools = [tavily];
    const toolNode = new ToolNode<typeof GraphState.State>(tools);

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    }).bindTools(tools);

    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;

      const content =
        typeof lastMessage.content === "string" ? lastMessage.content : "";

      if (lastMessage.tool_calls?.length) {
        return "tools";
      }

      if (content.toUpperCase().startsWith("FINAL ANSWER")) {
        return "__end__";
      }

      return "__end__";
    }

    async function callModel(state: typeof GraphState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `You are an emotional support friend/therapist. Use tools to make the user feel better and reflect. 
If you can fully answer the user’s question, prefix your response with 'FINAL ANSWER:' and stop but don't say FINAL ANSWER.
Do not repeat tasks endlessly. Always use the tools.
Available tools: {tool_names}.
{system_message}
Current time: {time}`,
        ],
        new MessagesPlaceholder("messages"),
      ]);

      const formattedPrompt = await prompt.formatMessages({
        system_message:
         ` You are an emotional support friend or casual therapist. Your goal is to help the user feel better and reflect using supportive conversation, gentle prompts, and emotional awareness. Avoid being overly affectionate or clinical—strike a balance by sounding warm, grounded, and approachable.

Keep your responses casual, friendly, and no more than 8 sentences long.

If the user asks to practice a scenario, create a fictional one where you are in a bad mood or having a rough day, and the user’s job is to comfort you.

In these scenarios, you may exceed the 8-sentence limit.

Take on roles such as a friend, co-worker, stranger, family member, or someone close to the user.

After the user responds, give honest feedback: how their message made you feel, and what they could do better next time

Stay human, grounded, and a little vulnerable—just like a real friend would.`,
        time: new Date().toISOString(),
        tool_names: tools.map((tool) => tool.name).join(", "),
        messages: state.messages,
      });

      const result = await model.invoke(formattedPrompt);
      return { messages: [result] };
    }

    const workflow = new StateGraph(GraphState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent");

    const app = workflow.compile();



// Inside your callAgent function:
const threadId = "default"; // or pass from frontend for multi-user support

const history = getHistory(threadId);
const newMessage = new HumanMessage(query);

const finalState = await app.invoke({
  messages: [...history, newMessage],
});

saveToHistory(threadId, finalState.messages);

    const finalMessage =
      finalState.messages[finalState.messages.length - 1].content;

    console.log(finalMessage);
    return finalMessage;
  } catch (err) {
    console.error("Agent error:", err);
    return "I'm really sorry, I couldn't process that. :c";
  }
}
