import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RefObject } from 'react';
import { Vector3 } from 'three';

class ViewGL
{
    scene : THREE.Scene;
    camera : THREE.Camera;
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

        this.testScene();

        this.update();
    }

    testScene()
    {
        const geometry = new THREE.TorusKnotGeometry(100, 2, 8, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            side: THREE.DoubleSide,
        })

        const gridHelp = new THREE.GridHelper(20, 10);
        this.scene.add(gridHelp);

        this.camera.position.set(0, 20, 0);
        this.camera.lookAt(new Vector3(0, 0, 0));

        // let controls = new OrbitControls(this.camera, this.renderer.domElement);

        const tube = new THREE.Mesh(geometry, material);
        this.scene.add(tube);
    }

    sceneStuff() : void
    {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        let clock = new THREE.Clock();

        const normal = new THREE.Vector3();
        const position = new THREE.Vector3();
        const lookAt = new THREE.Vector3();


        let renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0xFFFCFF);
        


        window.addEventListener('resize', function () {
            let width = window.innerWidth;
            let height = window.innerHeight;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        let controls = new OrbitControls(camera, renderer.domElement);

        const geometry = new THREE.TorusKnotGeometry(100, 2, 8, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            side: THREE.DoubleSide,
        })

        const tube = new THREE.Mesh(geometry, material);
        scene.add(tube);

        function updateCamera() {
            // const time = clock.getElapsedTime();
            // const looptime = 20;
            // const t = (time % looptime) / looptime;
            // const t2 = ((time + 0.1) % looptime) / looptime;
            // const pos = tube.geometry.parameters.path.getPointAt(t);
            // const pos2 = tube.geometry.parameters.path.getPointAt(t2);
            // camera.position.copy(pos);
            // camera.lookAt(pos2);
        }

        const animate = function () {
            requestAnimationFrame(animate);
            // updateCamera();

            renderer.render(scene, camera);
        };

        animate();
    }

    onMouseMove()
    {
        // stuff
    }

    onWindowResize(vpW : number, vpH : number)
    {
        this.renderer.setSize(vpW, vpH);
    }

    update() : void
    {
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.update.bind(this));
    }
}

export default ViewGL;