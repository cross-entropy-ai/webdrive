import { FileBrowser } from "./FileBrowser";
import "./index.css";

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <h1>webdrive</h1>
      </header>
      <FileBrowser />
    </div>
  );
}

export default App;
