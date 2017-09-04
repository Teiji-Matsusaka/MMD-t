QuaternionRotateControls = function ( scene, camera, domElement ) {
	var STAT = { NONE: 0, ROTATE: 1, MOVE: 2, ZOOM: 3, PAN: 4 };
	var KEYS = { RESET: 82, CAMERACTRL: 67, OBJECTCTRL: 77, SEARCH: 83 };
	var CTRL = { NONE: 0, CAMERA: 1, OBJECT: 2, OBJSELECT: 3 };
	this.scene = scene;
	this.camera = camera;
	this.domElement = ( domElement !== undefined ) ? domElement : document;
	this.ctrl = CTRL.CAMERA;
	this.object = undefined;

	this.eyeDef   = new THREE.Vector3().copy( camera.position );
	this.lookDef  = new THREE.Vector3( 0, 0, 0 );
	this.upDef    = new THREE.Vector3().copy( camera.up );
	this.eyePrev  = new THREE.Vector3().copy( camera.position );
	this.lookPrev = new THREE.Vector3( 0, 0, 0 );
	this.upPrev   = new THREE.Vector3().copy( camera.up );

	var scope = this;

	var state = STAT.NONE;
	var evPositionStart = new THREE.Vector2();
	var evPositionEnd = new THREE.Vector2();

	// 初期表示
	scope.camera.lookAt( this.lookPrev );
	this.setView( this.eyeDef, this.lookDef, this.upDef );

	scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );
	scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
	scope.domElement.addEventListener( 'mousemove', onMouseMove, false );
	scope.domElement.addEventListener( 'mouseup', onMouseUp, false );
	scope.domElement.addEventListener( 'wheel', onMouseWheel, false );
	window.addEventListener( 'keydown', onKeyDown, false );

	// 右クリックメニューを出さないようにする
	function onContextMenu( event ) {
		event.preventDefault();
	}

	function onMouseDown( event ) {
		if( scope.ctrl == CTRL.NONE ) return;
		if( scope.ctrl == CTRL.OBJSELECT ) {
			state = STAT.NONE;
			scope.object = scope.raySearchObject( event.clientX, event.clientY );
			return;
		}
		evPositionStart.set( event.clientX, event.clientY );
		if( event.button == THREE.MOUSE.LEFT   ) state = STAT.ROTATE;
		if( event.button == THREE.MOUSE.MIDDLE ) state = STAT.PAN;
		if( event.button == THREE.MOUSE.RIGHT )  state = STAT.MOVE;
	}

	function onMouseMove( event ) {
		if( scope.ctrl == CTRL.NONE ) return;
		if( state == STAT.NONE ) return;
		evPositionEnd.set( event.clientX, event.clientY );

		var ax = evPositionEnd.x - evPositionStart.x;
		var ay = - evPositionEnd.y + evPositionStart.y;
		var ar = Math.sqrt( ax * ax + ay * ay );
		var element = scope.domElement == document ? scope.domElement.body : scope.domElement;
		var dr = Math.sqrt( element.clientWidth * element.clientWidth + element.clientHeight * element.clientHeight );
		var vx = new THREE.Vector3( 1, 0, 0 ).applyQuaternion( scope.camera.quaternion ).normalize();
		var vy = new THREE.Vector3( 0, 1, 0 ).applyQuaternion( scope.camera.quaternion ).normalize();
		var vz = new THREE.Vector3( 0, 0, 1 ).applyQuaternion( scope.camera.quaternion ).normalize();

		if( state == STAT.ROTATE && scope.ctrl == CTRL.CAMERA ) {
			var tmp  = new THREE.Vector3().copy( scope.eyePrev ).sub( scope.lookPrev );
			var eye  = new THREE.Vector3( 0, 0, tmp.length() );
			var look = new THREE.Vector3().copy( scope.lookPrev );
			var up   = new THREE.Vector3().copy( scope.upPrev );
			var axis = new THREE.Vector3( -ay, ax, 0 ).normalize();
			var angle = Math.PI * ar / dr;
			var q = new THREE.Quaternion().setFromAxisAngle( axis, angle );
			//eye.sub( look );
			eye.applyQuaternion( q );
			eye.applyQuaternion( scope.camera.quaternion );
			eye.add( look );
			scope.setView( eye, look, up );
		}

		if( state == STAT.PAN && scope.ctrl == CTRL.CAMERA ) {
			var eye  = new THREE.Vector3().copy( scope.eyePrev );
			var look = new THREE.Vector3().copy( scope.lookPrev );
			var up   = new THREE.Vector3().copy( scope.upPrev );
			var ve = new THREE.Vector3().copy( eye ).sub( look ).normalize();
			var angle = Math.PI * ax / dr;
			var q = new THREE.Quaternion().setFromAxisAngle( ve, angle );
			up.applyQuaternion( q );
			scope.setView( eye, look, up );
		}

		if( state == STAT.MOVE && scope.ctrl == CTRL.CAMERA ) {
			var eye  = new THREE.Vector3().copy( scope.eyePrev );
			var look = new THREE.Vector3().copy( scope.lookPrev );
			var up   = new THREE.Vector3().copy( scope.upPrev );
			vx.multiplyScalar( ax );
			vy.multiplyScalar( ay );
			eye.add( vx ).add( vy );
			look.add( vx ).add( vy );
			scope.setView( eye, look, up );
		}

		if( state == STAT.ROTATE && scope.ctrl == CTRL.OBJECT ) {
			vx.multiplyScalar( ax );
			vy.multiplyScalar( ay );
			var q = new THREE.Quaternion();
			q.setFromAxisAngle( vz, Math.PI/2 );
			var axis = new THREE.Vector3().copy( vx ).add( vy );
			axis.applyQuaternion( q ).normalize();
			var angle = Math.PI * ar / dr;
			q.setFromAxisAngle( axis, angle );
			q.multiply( scope.object.quaternion );
			scope.object.quaternion.copy( q );
		}

		if( state == STAT.MOVE && scope.ctrl == CTRL.OBJECT ) {
			vx.multiplyScalar( ax );
			vy.multiplyScalar( ay );
			var mv = new THREE.Vector3().copy( vx ).add( vy );
			var q = new THREE.Quaternion().copy( scope.object.quaternion ).inverse();
			mv.applyQuaternion( q );
			// 移動処理
			scope.object.position.add( mv );
			for( var i=0; i<scope.object.children.length; i++ ) {
				scope.object.children[i].position.add( mv );
			}
		}

		evPositionStart.copy( evPositionEnd );
		scope.dispatchEvent( { type: 'change' } );
	}

	function onMouseUp( event ) {
		if( scope.ctrl == CTRL.NONE ) return;
		state = STAT.NONE;
	}

	function onMouseWheel( event ) {
		if( scope.ctrl == CTRL.NONE ) return;
		state = STAT.ZOOM;
		event.preventDefault();
		event.stopPropagation();
		var eye  = new THREE.Vector3().copy( scope.eyePrev );
		var look = new THREE.Vector3().copy( scope.lookPrev );
		var up   = new THREE.Vector3().copy( scope.upPrev );
		eye.sub( look );
		var dd = new THREE.Vector3().copy( eye ).normalize();
		dd.multiplyScalar( 10*event.deltaY );
		eye.add( dd );
		eye.add( look );
		scope.setView( eye, look, up );
		scope.dispatchEvent( { type: 'change' } );
	}

	function cameraCtrlReset() {
		if( ! scope.camera ) return;
		scope.eyePrev.copy( scope.eyeDef );
		scope.lookPrev.copy( scope.lookDef );
		scope.upPrev.copy( scope.upDef );
		scope.camera.position.copy( scope.eyeDef );
		scope.camera.up.copy( scope.upDef );
		scope.camera.lookAt( scope.lookDef );
	}

	function objectCtrlReset() {
		if( ! scope.object ) return;
		var mv = new THREE.Vector3().copy( scope.object.position );
		for( var i=0; i<scope.object.children.length; i++ ) {
			scope.object.children[i].position.sub( mv );
		}
		scope.object.position.set( 0, 0, 0 );
		scope.object.quaternion.set( 0, 0, 0, 1 );
	}

	function syncCamera() {
		scope.eyePrev.copy( scope.camera.position );
		scope.upPrev.copy( scope.camera.up );
		scope.lookPrev.copy( scope.camera.center );
		//scope.camera.lookAt( scope.camera.center );
	}

	function onKeyDown( event ) {
		if( scope.enableKeys == false ) return;
		if( event.keyCode == KEYS.CAMERACTRL ) {
			if( scope.camera ) {
				scope.ctrl = CTRL.CAMERA;
				syncCamera();
			}
		} else if( event.keyCode == KEYS.OBJECTCTRL ) {
			if( scope.object ) scope.ctrl = CTRL.OBJECT;
		} else if( event.keyCode == KEYS.RESET ) {
			if( scope.camera ) cameraCtrlReset();
			if( scope.object ) objectCtrlReset();
			scope.dispatchEvent( { type: 'change' } );
		} else if( event.keyCode == KEYS.SEARCH ) {
			scope.ctrl = CTRL.OBJSELECT;
		} else {
			scope.ctrl = CTRL.NONE;
		}
	}
};

QuaternionRotateControls.prototype = Object.create( THREE.EventDispatcher.prototype );
//QuaternionRotateControls.prototype.constructor = THREE.OrbitControls;

QuaternionRotateControls.prototype.setView = function( eye, look, up ) {
	if( ! this.camera ) return;
	var q1 = new THREE.Quaternion();
	var q2 = new THREE.Quaternion();
	var p  = new THREE.Vector3().copy( eye ).sub( look );
	var pp = new THREE.Vector3().copy( this.eyePrev ).sub( this.lookPrev );
	// カメラ方向
	q1.setFromUnitVectors( pp.normalize(), p.normalize() );
	q1.multiply( this.camera.quaternion );
	this.camera.quaternion.copy( q1 );
	// upの調整
	var tmp = new THREE.Vector3( 0, 1, 0 ).applyQuaternion( this.camera.quaternion );
	// 頭上方向
	q2.setFromUnitVectors( this.upPrev, up );
	q2.multiply( this.camera.quaternion );
	this.camera.quaternion.copy( q2 );
	// 変数の更新
	this.camera.position.copy( eye );
	this.camera.up.copy( tmp );
	this.eyePrev.copy( eye );
	this.lookPrev.copy( look );
	this.upPrev.copy( tmp );
};

QuaternionRotateControls.prototype.initView = function( eye, look, up ) {
	this.eyeDef.copy( eye );
	this.lookDef.copy( look );
	this.upDef.copy( up );

	this.eyePrev.copy( eye );
	this.lookPrev.copy( look );
	this.upPrev.copy( up );

	this.camera.position.copy( eye );
	this.camera.up.copy( up );
	this.camera.quaternion.set( 0, 0, 0, 1 );
	this.camera.lookAt( look );
};

QuaternionRotateControls.prototype.raySearchObject = function( x, y, w, h ) {
	var mouse = new THREE.Vector2();
	mouse.x =  ( x / window.innerWidth  ) * 2 - 1;
	mouse.y = -( y / window.innerHeight ) * 2 + 1;

	var ray = new THREE.Raycaster();
	ray.setFromCamera( mouse, this.camera );

	//ヒエラルキーを持った子要素も対象とする場合は第二引数にtrueを指定する
	//var objs = ray.intersectObjects( this.scene.children, true );
	var objs = ray.intersectObjects( this.scene.children );

	// 交差していたらobjsが1以上になる
	if( objs.length > 0 ) {
		console.log( 'オブジェクトを選択しました', objs.length, 'mouse:', mouse );
		return objs[0].object;
	} else {
		return undefined;
	}
};

