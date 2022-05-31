import { Link } from "react-router-dom";
import Scene from "../components/scene";
function About()
{
    return(
        <main>
            <Link to="/">Go Back</Link>
            <h2>
                About ma
            </h2>
            <Scene></Scene>
        </main>
    );
}

export default About;