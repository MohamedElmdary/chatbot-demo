import Head from "next/head";
import { useState } from "react";
import { useVisitorData } from "@fingerprintjs/fingerprintjs-pro-react";
import ReactMarkdown from "react-markdown";
import * as timeago from "timeago.js";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  ConversationHeader,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";

import styles from "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { useChannel } from "@ably-labs/react-hooks";
import { Types } from "ably";

type ConversationEntry = {
  message: string;
  speaker: "bot" | "user";
  date: Date;
  id?: string;
};

type request = {
  prompt: string;
};

const updateChatbotMessage = (
  conversation: ConversationEntry[],
  message: Types.Message
): ConversationEntry[] => {
  const interactionId = message.data.interactionId;

  const updatedConversation = conversation.reduce(
    (acc: ConversationEntry[], e: ConversationEntry) => [
      ...acc,
      e.id === interactionId
        ? { ...e, message: e.message + message.data.token }
        : e,
    ],
    []
  );

  return conversation.some((e) => e.id === interactionId)
    ? updatedConversation
    : [
        ...updatedConversation,
        {
          id: interactionId,
          message: message.data.token,
          speaker: "bot",
          date: new Date(),
        },
      ];
};

export default function Home() {
  const [text, setText] = useState("");
  const [extendedResult, updateExtendedResult] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [botIsTyping, setBotIsTyping] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Waiting for query...");

  const { isLoading, data: visitorData } = useVisitorData(
    { extendedResult },
    { immediate: true }
  );

  useChannel(visitorData?.visitorId! || "default", (message) => {
    switch (message.data.event) {
      case "response":
        setConversation((state) => updateChatbotMessage(state, message));
        break;
      case "status":
        setStatusMessage(message.data.message);
        break;
      case "responseEnd":
      default:
        setBotIsTyping(false);
        setStatusMessage("Waiting for query...");
    }
  });

  const submit = async () => {
    setConversation((state) => [
      ...state,
      {
        message: text,
        speaker: "user",
        date: new Date(),
      },
    ]);
    try {
      setBotIsTyping(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: text, userId: visitorData?.visitorId ?? "1" }),
      });

      const data = await response.json();
      console.log(data);
      
    } catch (error) {
      console.error("Error submitting message:", error);
    } finally {
      setBotIsTyping(false);
    }
    setText("");
  };

  return (
    <>
      <Head>
        <title>Pinecone Chatbot</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div
          style={{ position: "relative", height: "98vh", overflow: "hidden" }}
        >
          <MainContainer>
            <ChatContainer>
              <ConversationHeader>
                <ConversationHeader.Actions></ConversationHeader.Actions>
                <ConversationHeader.Content
                  userName="Pinecone Chatbot"
                  info={statusMessage}
                />
              </ConversationHeader>

              <MessageList
                typingIndicator={
                  botIsTyping ? (
                    <TypingIndicator content="Pinecone is typing" />
                  ) : null
                }
              >
                {conversation.map((entry, index) => {
                  return (
                    <Message
                      key={index}
                      style={{ width: "90%" }}
                      model={{
                        type: "custom",
                        sender: entry.speaker,
                        position: "single",
                        direction:
                          entry.speaker === "bot" ? "incoming" : "outgoing",
                      }}
                    >
                      <Message.CustomContent>
                        <ReactMarkdown>{entry.message}</ReactMarkdown>
                      </Message.CustomContent>
                      <Message.Footer
                        sentTime={timeago.format(entry.date)}
                        sender={entry.speaker === "bot" ? "Pinecone" : "You"}
                      />
                    </Message>
                  );
                })}
              </MessageList>
              <MessageInput
                placeholder="Type message here"
                onSend={submit}
                onChange={(e, text) => {
                  setText(text);
                }}
                sendButton={true}
                autoFocus
                disabled={isLoading}
              />
            </ChatContainer>
          </MainContainer>
        </div>
      </main>
    </>
  );
}
