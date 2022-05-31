import * as THREE from 'three';
import * as Curves from 'three/examples/jsm/curves/CurveExtras.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RefObject } from 'react';
import { Vector3 } from 'three';

class ViewGL
{
    rail! : THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
    scene : THREE.Scene;
    camera : THREE.PerspectiveCamera;
    clock : THREE.Clock;
    renderer : THREE.WebGLRenderer;

    constructor(canvasRef : RefObject<HTMLCanvasElement>)
    {
        // binds
        this.onWindowResize = this.onWindowResize.bind(this);


        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current!,
            antialias: false,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xFFFCFF);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.clock = new THREE.Clock();

        this.testScene();

        this.update();
    }

    testScene()
    {
        // const gridHelp = new THREE.GridHelper(20, 10);
        // this.scene.add(gridHelp);

        this.camera.position.set(0, 20, 0);
        this.camera.lookAt(new Vector3(0, 0, 0));

        // let controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.createPath();
        this.scene.add(this.rail);

        console.log(this.rail.geometry);
    }

    createPath() : void
    {
        const curve = new Curves.GrannyKnot();
        const geometry = new THREE.TubeBufferGeometry( curve, 100, 2, 8, true );
        const  material = new  THREE.MeshBasicMaterial({
             color:0x000000,
             wireframe: true,
             side:THREE.DoubleSide,
        });

        this.rail = new THREE.Mesh(geometry,material);
    }

    onMouseMove()
    {
        // stuff
    }

    onWindowResize(vpW : number, vpH : number)
    {
        // For aspect keeping
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(vpW, vpH);
    }

    updateCamera() : void
    {
        const time = this.clock.getElapsedTime();
        const looptime = 60;
        const t = (time % looptime) / looptime;
        const t2 = ((time + 0.1) % looptime) / looptime;
        const pos = this.rail.geometry.parameters.path.getPointAt(t);
        const pos2 = this.rail.geometry.parameters.path.getPointAt(t2);
        this.camera.position.copy(pos);
        this.camera.lookAt(pos2);
    }

    update() : void
    {
        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.update.bind(this));
    }
}

export default ViewGL;