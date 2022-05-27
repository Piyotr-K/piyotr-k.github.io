import { Link } from "react-router-dom";

function App() {
  return (
    <div>
      <h1>Book Keeper!</h1>
      <nav>
        <Link to="/landing">Main</Link> |{" "}
        <Link to="/about">About</Link>
      </nav>
    </div>
  );
}

export default App;
