import { Avatar } from "./components/Avatar";
import { Chat } from "./components/Chat";
import { useChat } from "./hooks/useChat";
import "./App.css";

function App() {
  const chat = useChat();

  return (
    <div className="app">
      <div className="app__avatar">
        <Avatar expression={chat.expression} />
      </div>
      <div className="app__chat">
        <Chat
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          sendMessage={chat.sendMessage}
          stopStreaming={chat.stopStreaming}
        />
      </div>
    </div>
  );
}

export default App;
