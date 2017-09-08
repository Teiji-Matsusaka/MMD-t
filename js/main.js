window.addEventListener( 'DOMContentLoaded', init );

function init() {
	const w = 800;
	const h = 600;

	camera   = new THREE.PerspectiveCamera( 45, w/h, 1, 10000 );	// カメラを作る
	scene    = new THREE.Scene();									// シーンを作る
	renderer = new THREE.WebGLRenderer();							// レンダラーを作る
	effect 　= new THREE.OutlineEffect( renderer );

	// 床登録
	scene.add( new THREE.PolarGridHelper(30, 10) );

	// ライトを作る
	const alight = new THREE.AmbientLight( 0x666666 );
	scene.add( alight );
	var dlight = new THREE.DirectionalLight( 0x887766 );
	dlight.position.set( -1, 1, 1 ).normalize();
	scene.add( dlight );

	// 背景色変更
	renderer.setClearColor( 0x888888 );

	// MMD
	mmd = new MMD( scene, camera );
	mmd.addEventListener( 'change', display, false );

	// 再生コントロール用
	var slider = document.getElementById( 'slider' );
	if( slider ) mmd.helper.setController( slider );

	// オブジェクトをグリグリする用
	const Control = new QuaternionRotateControls( scene, camera );
	Control.initView( new THREE.Vector3(0, 10, 30), new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 1, 0) );
	Control.ctrl = 0;	// CTRL.NONE
	Control.addEventListener( 'change', display, false );

	// 描画領域を配置する
	renderer.setSize( w, h );
	document.body.appendChild( renderer.domElement );

	// 描画する
	renderer.render( scene, camera );
}

function LoadModel() {
	var ModelFileName = document.getElementById( 'ModelFile' ).value;
	mmd.loader.initModel( 0 );
	mmd.loader.loadModel( 0, ModelFileName );
}

function LoadMotion() {
	var MotionFileName = document.getElementById( 'MotionFile' ).value;
	mmd.helper.setPhysicsParams( { warmup: 60 } );
	mmd.loader.loadMotion( 0, MotionFileName );
}

function LoadCameraWork() {
	var CameraWorkFileName = document.getElementById( 'CameraWorkFile' ).value;
	mmd.loader.initCameraWork();
	mmd.loader.loadCameraWork( CameraWorkFileName );
}

function LoadAudio() {
	var AudioFileName = document.getElementById( 'AudioFile' ).value;
	mmd.loader.initAudio();
	mmd.helper.setAudioParams( { audioDelay: 160 * 1 / 30 } );
	mmd.loader.loadAudio( AudioFileName );
}

function load() {
	var ModelFileName = document.getElementById( 'ModelFile' ).value;
	var MotionFileName = document.getElementById( 'MotionFile' ).value;
	var CameraWorkFileName = document.getElementById( 'CameraWorkFile' ).value;
	var AudioFileName = document.getElementById( 'AudioFile' ).value;

	if( ! mmd.loader.loadedModel || ! mmd.loader.loadedMotion ) {
		mmd.loader.initModel( 0 );
		mmd.loader.loadModel( 0, ModelFileName, function() {
			mmd.loader.loadMotion( 0, MotionFileName );
		} );
	}
	if( ! mmd.loader.loadedCameraWork ) {
		mmd.loader.initCameraWork();
		mmd.loader.loadCameraWork( CameraWorkFileName );
	}
	if( ! mmd.loader.loadedAudio ) {
		mmd.loader.initAudio();
		mmd.helper.setAudioParams( { audioDelay: 160 * 1 / 30 } );
		mmd.loader.loadAudio( AudioFileName );
	}
	mmd.loader.checkDuration();
}

function display() {
	//renderer.render( scene, camera );
	effect.render( scene, camera );
}

function motion() {
	mmd.helper.play();
}

function stopmotion() {
	mmd.helper.stop();
}

