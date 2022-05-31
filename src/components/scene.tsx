import React, { RefObject } from "react";
import ViewGL from "./viewgl";

interface CanvasProps
{
}

class Scene extends React.Component {

    canvasRef : RefObject<HTMLCanvasElement>;
    viewGL! : ViewGL;

    constructor(props : CanvasProps)
    {
        super(props);
        this.canvasRef = React.createRef<HTMLCanvasElement>();

        // binds
        /*
            Need to bind otherwise function context "this" will be undefined
        */
        this.handleResize = this.handleResize.bind(this);
    }

    componentDidMount()
    {
        this.viewGL = new ViewGL(this.canvasRef);

        window.addEventListener('mousemove', this.mouseMove);
        window.addEventListener('resize', this.handleResize);
    }

    componentDidUpdate()
    {

    }

    componentWillUnmount()
    {
        window.removeEventListener('mousemove', this.mouseMove);
        window.removeEventListener('resize', this.handleResize);
    }

    mouseMove(e : Event)
    {
        // console.log(e);
    }

    handleResize()
    {
        this.viewGL.onWindowResize(window.innerWidth, window.innerHeight);
    }

    render()
    {
        return (
            <div className="container-canvas">
                <canvas ref={this.canvasRef}></canvas>
            </div>
        );
    }
}
export default Scene;