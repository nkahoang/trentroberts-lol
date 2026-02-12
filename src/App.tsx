import { Avatar } from "./components/Avatar";
import { Chat } from "./components/Chat";
import "./App.css";

function App() {
  return (
    <div className="app">
      <div className="app__avatar">
        <Avatar />
      </div>
      <div className="app__chat">
        <Chat />
      </div>
    </div>
  );
}

export default App;
