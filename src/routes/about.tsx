import { Link } from "react-router-dom";
import Scene from "../components/scene";
import "./about.css";
function About()
{
    return(
        <main>
            <div className = "div-container">
                <Link to="/">Go Back</Link>
                <h2>
                    About ma
                </h2>
            </div>
            <Scene></Scene>
        </main>
    );
}

export default About;