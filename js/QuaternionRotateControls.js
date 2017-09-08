QuaternionRotateControls = function ( scene, camera, domElement ) {
	var STAT = { NONE: 0, ROTATE: 1, MOVE: 2, ZOOM: 3, PAN: 4 };
	var KEYS = { RESET: 82, CAMERACTRL: 67, OBJECTCTRL: 77, SEARCH: 83 };
	var CTRL = { NONE: 0, CAMERA: 1, OBJECT: 2, OBJSELECT: 3 };
	this.scene = scene;
	this.camera = camera;
	this.domElement = ( domElement !== undefined ) ? domElement : document;
	this.ctrl = CTRL.CAMERA;
	this.object = undefined;

	camera.center = new THREE.Vector3( 0, 0, 0 );	//変数追加
	this.eye   = new THREE.Vector3().copy( camera.position );
	this.look  = new THREE.Vector3().copy( camera.center );
	this.up    = new THREE.Vector3().copy( camera.up );

	var scope = this;

	var state = STAT.NONE;
	var evPositionStart = new THREE.Vector2();
	var evPositionEnd = new THREE.Vector2();

	// 初期表示
	scope.camera.lookAt( this.look );
	this.setView( this.eye, this.look, this.up );

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
		var ex = new THREE.Vector3( 1, 0, 0 ).applyQuaternion( scope.camera.quaternion ).normalize();
		var ey = new THREE.Vector3( 0, 1, 0 ).applyQuaternion( scope.camera.quaternion ).normalize();
		var ez = new THREE.Vector3( 0, 0, 1 ).applyQuaternion( scope.camera.quaternion ).normalize();

		if( state == STAT.ROTATE && scope.ctrl == CTRL.CAMERA ) {
			var eye  = new THREE.Vector3().copy( scope.camera.position );
			var look = new THREE.Vector3().copy( scope.camera.center );
			var up   = new THREE.Vector3().copy( scope.camera.up );
			var axis = new THREE.Vector3( -ay, ax, 0 ).normalize();
			var angle = Math.PI * ar / dr;
			var q = new THREE.Quaternion().setFromAxisAngle( axis, angle );
			var qi = new THREE.Quaternion().copy( scope.camera.quaternion ).inverse();
			eye.sub( look );
			eye.applyQuaternion( qi );
			eye.applyQuaternion( q );
			eye.applyQuaternion( scope.camera.quaternion );
			eye.add( look );
			up.applyQuaternion( qi );
			up.applyQuaternion( q );
			up.applyQuaternion( scope.camera.quaternion ).normalize();
			scope.setView( eye, look, up );
		}

		if( state == STAT.PAN && scope.ctrl == CTRL.CAMERA ) {
			var eye  = new THREE.Vector3().copy( scope.camera.position );
			var look = new THREE.Vector3().copy( scope.camera.center );
			var up   = new THREE.Vector3().copy( scope.camera.up );
			var v = new THREE.Vector3().copy( eye ).sub( look ).normalize();
			var angle = Math.PI * ax / dr;
			var q = new THREE.Quaternion().setFromAxisAngle( v, angle );
			up.applyQuaternion( q );
			scope.setView( eye, look, up );
		}

		if( state == STAT.MOVE && scope.ctrl == CTRL.CAMERA ) {
			var eye  = new THREE.Vector3().copy( scope.camera.position );
			var look = new THREE.Vector3().copy( scope.camera.center );
			var up   = new THREE.Vector3().copy( scope.camera.up );
			ex.multiplyScalar( ax );
			ey.multiplyScalar( ay );
			eye.add( ex ).add( ey );
			look.add( ex ).add( ey );
			scope.setView( eye, look, up );
		}

		if( state == STAT.ROTATE && scope.ctrl == CTRL.OBJECT ) {
			ex.multiplyScalar( ax );
			ey.multiplyScalar( ay );
			var q = new THREE.Quaternion();
			q.setFromAxisAngle( ez, Math.PI/2 );
			var axis = new THREE.Vector3().copy( ex ).add( ey );
			axis.applyQuaternion( q ).normalize();
			var angle = Math.PI * ar / dr;
			q.setFromAxisAngle( axis, angle );
			q.multiply( scope.object.quaternion );
			scope.object.quaternion.copy( q );
		}

		if( state == STAT.MOVE && scope.ctrl == CTRL.OBJECT ) {
			ex.multiplyScalar( ax );
			ey.multiplyScalar( ay );
			var mv = new THREE.Vector3().copy( ex ).add( ey );
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
		var eye  = new THREE.Vector3().copy( scope.camera.position );
		var look = new THREE.Vector3().copy( scope.camera.center );
		var up   = new THREE.Vector3().copy( scope.camera.up );
		eye.sub( look );
		var dd = new THREE.Vector3().copy( eye ).normalize();
		dd.multiplyScalar( 10*event.deltaY );
		eye.add( dd );
		eye.add( look );
		scope.setView( eye, look, up );
		scope.dispatchEvent( { type: 'change' } );
	}

	function cameraCtrlReset() {
		if( scope.camera ) scope.setView( scope.eye, scope.look, scope.up );
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

	function onKeyDown( event ) {
		if( scope.enableKeys == false ) return;
		if( event.keyCode == KEYS.CAMERACTRL ) {
			if( scope.camera ) scope.ctrl = CTRL.CAMERA;
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
QuaternionRotateControls.prototype.constructor = QuaternionRotateControls;

QuaternionRotateControls.prototype.setView = function( eye, look, up ) {
	if( this.camera ) {
		this.camera.position.copy( eye );
		this.camera.center.copy( look );
		this.camera.up.copy( up );
		this.camera.lookAt( look );
	}
};

QuaternionRotateControls.prototype.initView = function( eye, look, up ) {
	this.eye.copy( eye );
	this.look.copy( look );
	this.up.copy( up );

	this.setView( eye, look, up );
};

QuaternionRotateControls.prototype.raySearchObject = function( x, y ) {
	var mouse = new THREE.Vector2();
	mouse.x =  ( x / window.innerWidth  ) * 2 - 1;
	mouse.y = -( y / window.innerHeight ) * 2 + 1;

	var ray = new THREE.Raycaster();
	ray.setFromCamera( mouse, this.camera );

	var objects = ray.intersectObjects( this.scene.children );

	// 交差していたらobjectsが1以上になる
	if( objects.length > 0 ) {
		console.log( 'オブジェクトを選択しました', objects.length, 'mouse:', mouse );
		return objects[0].object;
	} else {
		return undefined;
	}
};

