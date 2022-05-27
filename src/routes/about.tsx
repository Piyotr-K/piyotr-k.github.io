import { Link } from "react-router-dom";
function About()
{
    return(
        <main>
            <Link to="/">Go Back</Link>
            <h2>
                About ma
            </h2>
            <canvas id="screen"></canvas>
        </main>
    );
}

export default About;