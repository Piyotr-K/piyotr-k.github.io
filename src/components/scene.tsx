const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
let clock = new THREE.Clock();

const normal = new THREE.Vector3();
const position = new THREE.Vector3();
const lookAt = new THREE.Vector3();


let renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xFFFCFF);
document.getElementById("canvas").appendChild(renderer.domElement);


window.addEventListener('resize', function () {
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});
let controls = new THREE.OrbitControls(camera, renderer.domElement);

const curve = new THREE.Curves.GrannyKnot();
const geometry = new THREE.TubeBufferGeometry(curve, 100, 2, 8, true);
const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    wireframe: true,
    side: THREE.DoubleSide,
})

const tube = new THREE.Mesh(geometry, material);
scene.add(tube);




function updateCamera() {
    const time = clock.getElapsedTime();
    const looptime = 20;
    const t = (time % looptime) / looptime;
    const t2 = ((time + 0.1) % looptime) / looptime;
    const pos = tube.geometry.parameters.path.getPointAt(t);
    const pos2 = tube.geometry.parameters.path.getPointAt(t2);
    camera.position.copy(pos);
    camera.lookAt(pos2);
}

const animate = function () {
    requestAnimationFrame(animate);
    updateCamera();

    renderer.render(scene, camera);
};

animate();