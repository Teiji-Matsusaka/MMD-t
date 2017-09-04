//------------------------------------------------------------------------------------------------------------------
MMD = function( scene, camera ) {
	this.scene = scene;
	this.camera = camera;
	this.meshes = [];
	this.audio = null;
	this.listener = null;

	this.loader = new MMD.Loader( this );
	this.helper = new MMD.AnimationHelper( this );
};

MMD.prototype = Object.create( THREE.EventDispatcher.prototype );
MMD.prototype.constructor = MMD;

MMD.prototype.refMMDProperty = function( mmd, subClass ) {
	if( ! subClass ) subClass = this;
	subClass.mmd = mmd;
	subClass.scene = mmd.scene;
	subClass.camera = mmd.camera;
	subClass.meshes = mmd.meshes;
	subClass.audio = mmd.audio;
	subClass.listener = mmd.listener;
};


//------------------------------------------------------------------------------------------------------------------
MMD.Loader = function( mmd ) {
	// refarence MMD property
	this.refMMDProperty( mmd, this );

	//this.manager = ( a_manager !== undefined ) ? a_manager : THREE.DefaultLoadingManager;
	this.manager = THREE.DefaultLoadingManager;
	this.parser = new MMDParser.Parser();
	this.MMDLoader = new THREE.MMDLoader()

	this.loadedModel = undefined;
	this.loadedMotion = undefined;
	this.loadedCameraWork = undefined;
	this.loadedAudio = undefined;
};

MMD.Loader.prototype = Object.create( MMD.prototype );
MMD.Loader.prototype.constructor = MMD.Loader;

//------------------------------------------------------------------------------------------------------------------
MMD.AnimationHelper = function( mmd ) {
	// refarence MMD property
	this.refMMDProperty( mmd, this );

	this.eventHelper = new MMD.EventHelper();
	this.clock = new THREE.Clock();

	// animation control
	this.animateID = undefined;
	this.controller = undefined;
	this.isPlaying = undefined;
	this.doAnimation = true;
	this.doCameraAnimation = true;

	// option solver
	this.doIk = true;
	this.doGrant = true;
	this.doPhysics = 1;	// 0=none 1=normal 2=shared
	this.masterPhysics = null;
	this.physicsParams = undefined;

	// audio conrol
	this.audioDelay = 0;
	this.isAudioPlaying = undefined;
	this.audioParams = undefined;

	// time control
	this.duration = undefined;
	this.time = 0;
};

MMD.AnimationHelper.prototype = Object.create( MMD.prototype );
MMD.AnimationHelper.prototype.constructor = MMD.AnimationHelper;

MMD.Loader.prototype.loadFile = function( url, onLoad, onLoadEnd, onProgress, onError, responseType, mimeType ) {
	var fileloader = new THREE.FileLoader( this.manager );

	if( mimeType     ) fileloader.setMimeType( mimeType );
	if( responseType ) fileloader.setResponseType( responseType );

	var request = fileloader.load( url, function( result ) {
		onLoad( result );
	}, onProgress, onError );

	request.onloadend = function( e ) {
		//console.log( 'onloadend event status', e.target.status );
		if( e.target.status ) onLoadEnd( e );
	}

	return request;
};

MMD.Loader.prototype.clearMesh = function( scene, mesh ) {
	// dispose & delete
	if( mesh ) {
		if( mesh.geometry ) {
			if( mesh.geometry.animations ) delete mesh.geometry.animations;
			mesh.geometry.dispose();
			delete mesh.geometry;
		}
		if( mesh.material ) {
			// mapがtexture?
			for( var i in mesh.material ) {
				if( mesh.material[i].map ) {
					mesh.material[i].map.dispose();
					delete mesh.material[i].map;
				}
				mesh.material[i].dispose();
				delete mesh.material[i];
			}
		}
		scene.remove( mesh );
		//delete mesh;
	}
};

MMD.Loader.prototype.initModel = function( no ) {
	var meshes = this.meshes;

	if( meshes[no] ) {
		this.clearMesh( mmd.scene, meshes[no] );
		delete meshes[no];
	}
};

MMD.Loader.prototype.initCameraWork = function() {
	var camera = this.camera;
	if( camera.mixer ) camera.mixer = null;
	if( camera.animations ) {
		for( var i in camera.animations ) {
			delete camera.animations[i];
		}
		delete camera.animations;
	}
};

MMD.Loader.prototype.initAudio = function() {
	var scene = this.scene;
	var audio = this.audio;
	var listener = this.listener;

	if( audio ) scene.remove( audio );
	if( listener ) scene.remove( listener );

	if( audio ) {
		audio.stop();
		delete audio;
	}
	if( listener ) delete listener;
};

MMD.Loader.prototype.loadModel = function( no, url, callback, onProgress, onError ) {
	if( url == '' ) {
		this.loadedModel = true;
		return;
	}

	var scope = this;
	var loader = this.MMDLoader;
	var parse = this.parser;

	var path = loader.extractUrlBase( url );
	this.mmd.helper.duration = 0;

	var model = undefined;
	var mesh = undefined;
	this.loadedModel = undefined;
	var xhr = this.loadFile( url, onLoad, onLoadEnd, onProgress, onError, 'arraybuffer' );

	function onLoad( buffer ) {
		var magic = scope.getFileMagic( buffer ).substr( 0, 3 );
		if( magic == 'PMX' ) {
			model = parse.parsePmx( buffer, true );
		} else if( magic == 'Pmd' ) {
			model = parse.parsePmd( buffer, true );
		} else {
			throw 'Unknown model format.';
		}
	}

	function onLoadEnd( e ) {
		mesh = loader.createMesh( model, path, onProgress, onError );
		scope.addMesh( no, mesh );
		scope.mmd.dispatchEvent( { type: 'change' } );
		scope.loadedModel = true;
		console.log( 'Model onLoadEnd' );
		if( callback ) callback( mesh );
	}
};

MMD.Loader.prototype.loadMotion = function( no, url, callback, onProgress, onError ) {
	if( url == '' ) {
		this.loadedMotion = true;
		return;
	}

	var scope = this;
	var loader = this.MMDLoader;
	var mesh = this.meshes[no];
	var helper = this.mmd.helper;
	var parse = this.parser;

	var motion = undefined;
	this.loadedMotion = undefined;
	this.loadFile( url, onLoad, onLoadEnd, onProgress, onError, 'arraybuffer' );

	function onLoad( buffer ) {
		motion = parse.parseVmd( buffer, true );
	}

	function onLoadEnd( e ) {
		loader.createAnimation( mesh, motion );
		helper.initAnimation( mesh );
		scope.loadedMotion = true;

		var duration = 0;
		//for( var i in mesh.mixer._actions ) {
		//	var action = mesh.mixer._actions[i];
		//	duration = Math.max( duration, action._clip.duration );
		//}
		for( var i in mesh.geometry.animations ) {
			var clip = mesh.geometry.animations[i];
			duration = Math.max( duration, clip.duration );
		}
		if( duration > helper.duration ) helper.duration = duration;
		console.log( 'Motion onLoadEnd', 'Motion Duration', duration );

		if( callback ) callback( mesh );
	}
};

MMD.Loader.prototype.loadCameraWork = function( url, callback, onProgress, onError ) {
	if( url == '' ) {
		this.loadedCameraWork = true;
		return;
	}

	var scope = this;
	var loader = this.MMDLoader;
	var camera = this.camera;
	var helper = this.mmd.helper;
	var parse = this.parser;

	var vmd = undefined;
	this.loadedCameraWork = undefined;
	this.loadFile( url, onLoad, onLoadEnd, onProgress, onError, 'arraybuffer' );

	function onLoad( buffer ) {
		vmd = parse.parseVmd( buffer, true );
	}

	function onLoadEnd( e ) {
		loader.pourVmdIntoCamera( camera, vmd );
		helper.setCameraWork( camera );
		scope.loadedCameraWork = true;

		var duration = 0;
		//for( var i in camera.mixer._actions ) {
		//	var action = camera.mixer._actions[i];
		//	duration = Math.max( duration, action._clip.duration );
		//}
		for( var i in camera.animations ) {
			var clip = camera.animations[i];
			duration = Math.max( duration, clip.duration );
		}
		if( duration > helper.duration ) helper.duration = duration;
		console.log( 'CameraWork onLoadEnd', 'CameraWork Duration', duration );

		if( callback ) callback( vmd );
	}
};

MMD.Loader.prototype.loadAudio = function ( url, callback, onProgress, onError ) {
	if( url == '' ) {
		this.loadedAudio = true;
		return;
	}

	scope = this;
	var helper = this.mmd.helper;

	var listener = new THREE.AudioListener();
	var audio = new THREE.Audio( listener );
	var loader = new THREE.AudioLoader( this.manager );

	this.loadedAudio = undefined;
	loader.load( url, onLoad, onProgress, onError );

	function onLoad( buffer ) {
		audio.setBuffer( buffer );
		helper.setAudio( audio, listener );
		mmd.scene.add( audio );
		mmd.scene.add( listener );
		scope.loadedAudio = true;

		var audioDuration = audio.buffer.duration + helper.audioDelay;
		console.log( 'Audio onLoad', 'Audio Duration', audioDuration, 'Audio Delay', helper.audioDelay );

		if( callback ) callback( audio, listener );
	}
};

MMD.Loader.prototype.getFileMagic = function( buffer ) {
	var dv = new DataView( buffer, 0 );
	var magic = '';
	magic += String.fromCharCode( dv.getUint8(0) );
	magic += String.fromCharCode( dv.getUint8(1) );
	magic += String.fromCharCode( dv.getUint8(2) );
	magic += String.fromCharCode( dv.getUint8(3) );
	return magic;
};

MMD.Loader.prototype.checkDuration = function() {
	var scope = this;
	var helper = this.mmd.helper;
	var controller = this.mmd.helper.controller;

	// wait loding
	function loaded() {
		if( scope.loadedModel && scope.loadedMotion && scope.loadedCameraWork && scope.loadedAudio ) {
			console.log( 'end loading',
					'Model', scope.loadedModel,
					'Motion', scope.loadedMotion,
					'CameraWork', scope.loadedCameraWork,
					'Audio', scope.loadedAudio ); 
			return false;
		} else {
			console.log( 'wait loading...',
					'Model', scope.loadedModel,
					'Motion', scope.loadedMotion,
					'CameraWork', scope.loadedCameraWork,
					'Audio', scope.loadedAudio ); 
			return true;
		}
	}
	while( loaded() ) setTimeout( function(){}, 1000 );

	if( controller ) {
		//controller.step = helper.duration / 100;
		controller.max = helper.duration;
		controller.valueAsNumber = 0;
	}

	console.log( 'duration', helper.duration );
};

MMD.Loader.prototype.addMesh = function( no, mesh ) {
	if( ! mesh ) return;

	if( ! ( mesh instanceof THREE.SkinnedMesh ) ) {
		throw new Error( 'MMD.Loader.addMesh() accepts only THREE.SkinnedMesh instance.' );
	}
	if( mesh.mixer       === undefined ) mesh.mixer       = null;
	if( mesh.ikSolver    === undefined ) mesh.ikSolver    = null;
	if( mesh.grantSolver === undefined ) mesh.grantSolver = null;
	if( mesh.physics     === undefined ) mesh.physics     = null;

	this.meshes[no] = mesh;

	this.mmd.helper.initBackupBones( mesh );

	this.mmd.scene.add( mesh );
};

MMD.AnimationHelper.prototype.setController = function( slider ) {
	this.controller = slider;
	this.controller.addEventListener( 'input', ControllerInput, false );		// ドラッグ中のイベント
	//this.controller.addEventListener( 'change', ControllerChange, false );		// マウスアップした際のイベント

	var scope = this;
	var controller = this.controller;

	function ControllerInput( e ) {
		scope.atTime( controller.valueAsNumber );
	}
};

MMD.AnimationHelper.prototype.initAnimation = function( mesh ) {
	if( mesh.geometry.animations ) {
		mesh.mixer = new THREE.AnimationMixer( mesh );

		var foundAnimation = false;
		var foundMorphAnimation = false;

		for( var i in mesh.geometry.animations ) {
			var clip = mesh.geometry.animations[i];
			var action = mesh.mixer.clipAction( clip );
			if( clip.tracks.length > 0 && clip.tracks[0].name.indexOf( '.morphTargetInfluences' ) === 0 ) {
				if( ! foundMorphAnimation ) {
					action.play();
					foundMorphAnimation = true;
				}
			} else {
				if( ! foundAnimation ) {
					action.play();
					foundAnimation = true;
				}
			}
		}

		if( foundAnimation ) {
			if( this.doIk ) mesh.ikSolver = new THREE.CCDIKSolver( mesh );
			if( this.doGrant && mesh.geometry.grants ) mesh.grantSolver = new THREE.MMDGrantSolver( mesh );
		}
	}

	if( this.doPhysics ) this.setPhysics( mesh );
};

MMD.AnimationHelper.prototype.setCameraWork = function( camera ) {
	if( camera.animations ) {
		camera.mixer = new THREE.AnimationMixer( camera );
		camera.mixer.clipAction( camera.animations[0] ).play();
	}
};

MMD.AnimationHelper.prototype.setAudio = function( audio, listener ) {
	this.audioParams = this.audioParams ? this.audioParams : {};

	this.audio = audio;
	this.listener = listener;

	this.time = 0;
	this.audioDelay = this.audioParams.audioDelay ? this.audioParams.audioDelay : 0;

	var audioDuration = this.audio.buffer.duration + this.audioDelay;
	if( audioDuration > this.duration ) this.duration = audioDuration;
};

MMD.AnimationHelper.prototype.play = function() {
	if( this.animateID ) return;
	if( ! this.doAnimation ) return;

	var scope = this;
	var controller = this.controller;

	function update() {
		scope.animateID = requestAnimationFrame( update );

		//var theta = clock.getElapsedTime();
		scope.update( scope.clock.getDelta() );
		scope.mmd.dispatchEvent( { type: 'change' } );

		if( controller ) controller.valueAsNumber = scope.time;
	}

	//console.log( 'start controller time', controller.valueAsNumber, 'mixer.time', this.meshes[0].mixer.time, 'this.time', this.time );

	if( ! this.isPlaying ) {
		this.isPlaying = true;
		this.clock.start();
		this.animateID = requestAnimationFrame( update );
	}

	function loop( event ) {
		scope.stop();
		scope.atTime( 0 );

		// controller reset
		if( controller ) controller.valueAsNumber = 0;
	}

	this.eventHelper.add( this.meshes[0].mixer, 'loop', loop, false );
};

MMD.AnimationHelper.prototype.stop = function() {
	this.clock.stop();
	this.eventHelper.removeAtObject( this.meshes[0].mixer );
	this.isPlaying = false;
	cancelAnimationFrame( this.animateID );
	this.stopAudio();
	this.animateID = undefined;

	//console.log( 'stop  controller time', this.controller.valueAsNumber, 'mixer.time', this.meshes[0].mixer.time, 'this.time', this.time );
};

MMD.AnimationHelper.prototype.playAudio = function() {
	if( ! this.audio ) return;
	if( ! this.isAudioPlaying ) {		// audio.isPlayingだとタイムラグがある？
		if( this.time >= this.audioDelay ) {
			this.isAudioPlaying = true;
			this.audio.startTime = this.time - this.audioDelay;
			this.audio.play();
		}
	}
};

MMD.AnimationHelper.prototype.stopAudio = function() {
	if( ! this.audio ) return;
	if( this.isAudioPlaying ) {		// audio.isPlayingだとタイムラグがある？
		this.isAudioPlaying = false;
		this.audio.stop();
	}
};

MMD.AnimationHelper.prototype.atTime = function( at ) {
	var delta = at - this.time;

	// update
	//console.log( 'before update delta', delta, 'at time', at, 'time', this.time );
	this.stopAudio();
	this.update( delta );
	//console.log( 'after update  delta', delta, 'at time', at, 'time', this.time );

	// 時間がゼロならリセット
	if( this.time < 0.00001 ) {
		for( var i in this.meshes ) {
			this.meshes[i].physics.reset();
			this.meshes[i].physics.warmup( this.physicsParams.warmup );
		}
	}

	this.mmd.dispatchEvent( { type: 'change' } );
};

MMD.AnimationHelper.prototype.update = function( delta ) {
	this.time += delta;

	for( var i in this.meshes ) {
		this.meshUpdate( delta, this.meshes[i] );
	}
	if( this.doPhysics ==2 ) this.updateSharedPhysics( delta );
	if( this.doCameraAnimation ) this.cameraUpdate( delta, this.camera );
	if( this.isPlaying ) {
		this.playAudio();
	} else {
		this.stopAudio(); 
	}
};

MMD.AnimationHelper.prototype.updateSharedPhysics = function( delta ) {
	if( this.meshes || ! this.doPhysics ) return;

	var physics = this.getMasterPhysics();
	if( ! physics ) return;

	for( var i in this.meshes ) {
		var p = this.meshes[i].physics;
		if( p ) p.updateRigidBodies();

	}

	physics.stepSimulation( delta );

	for( var i in this.meshes ) {
		var p = this.meshes[i].physics;
		if( p ) p.updateBones();
	}
};

MMD.AnimationHelper.prototype.meshUpdate = function( delta, mesh ) {
	if( mesh.mixer ) {
		this.restoreBones( mesh );
		mesh.mixer.update( delta );
		this.backupBones( mesh );
	}
	if( mesh.ikSolver && this.doIk ) mesh.ikSolver.update();
	if( mesh.grantSolver && this.doGrant ) mesh.grantSolver.update();
	if( mesh.physics && this.doPhysics == 1 ) mesh.physics.update( delta );
};

MMD.AnimationHelper.prototype.cameraUpdate = function( delta, camera ) {
	if( camera ) {
		camera.mixer.update( delta );

		camera.updateProjectionMatrix();
		camera.up.set( 0, 1, 0 );
		camera.up.applyQuaternion( camera.quaternion );
		camera.lookAt( camera.center );
	}
};

MMD.AnimationHelper.prototype.setPhysics = function( mesh ) {
	this.physicsParams = this.physicsParams ? Object.assign( {}, this.physicsParams ) : {};
	if( this.physicsParams.world === undefined && this.doPhysics == 2 ) {
		var masterPhysics = this.getMasterPhysics();
		if( masterPhysics ) this.physicsParams.world = masterPhysics.world;
	}

	this.physicsParams.warmup = this.physicsParams.warmup ? this.physicsParams.warmup : 60;
	var physics = new THREE.MMDPhysics( mesh, this.physicsParams );

	if( mesh.mixer && ! this.physicsParams.preventAnimationWarmup ) {
		this.meshUpdate( 0, mesh );
		physics.reset();
	}

	physics.warmup( this.physicsParams.warmup );

	var iks = mesh.geometry.iks;
	var bones = mesh.geometry.bones;
	for( var i in iks ) {
		var ik = iks[i];
		var links = ik.links;

		for( var j in links ) {
			var link = links[j];
			if( this.doPhysics ) {
				// disable IK of the bone the corresponding rigidBody type of which is 1 or 2
				// because its rotation will be overriden by physics
				link.enabled = bones[link.index].rigidBodyType > 0 ? false : true;
			} else {
				link.enabled = true;
			}
		}
	}

	mesh.physics = physics;
};

MMD.AnimationHelper.prototype.getMasterPhysics = function() {
	if( this.masterPhysics ) return this.masterPhysics;

	for( var i in this.meshes ) {
		var physics = this.meshes[i].physics;
		if( physics ) {
			this.masterPhysics = physics;
			return this.masterPhysics;
		}
	}

	return null;
};

MMD.AnimationHelper.prototype.setPhysicsParams = function( p ) {
	this.physicsParams = p;
};

MMD.AnimationHelper.prototype.setAudioParams = function( p ) {
	this.audioParams = p;
};

/*
 * Note: These following three functions are workaround for r74dev.
 *       THREE.PropertyMixer.apply() seems to save values into buffer cache
 *       when mixer.update() is called.
 *       ikSolver.update() and physics.update() change bone position/quaternion
 *       without mixer.update() then buffer cache will be inconsistent.
 *       So trying to avoid buffer cache inconsistency by doing
 *       backup bones position/quaternion right after mixer.update() call
 *       and then restore them after rendering.
 */
MMD.AnimationHelper.prototype.initBackupBones = function( mesh ) {
	mesh.skeleton.backupBones = [];
	for( var i in mesh.skeleton.bones ) {
		mesh.skeleton.backupBones.push( mesh.skeleton.bones[i].clone() );
	}
};

MMD.AnimationHelper.prototype.backupBones = function( mesh ) {
	mesh.skeleton.backupBoneIsSaved = true;
	for( var i in mesh.skeleton.bones ) {
		var b = mesh.skeleton.backupBones[i];
		var b2 = mesh.skeleton.bones[i];
		b.position.copy( b2.position );
		b.quaternion.copy( b2.quaternion );
	}
};

MMD.AnimationHelper.prototype.restoreBones = function( mesh ) {
	if( ! mesh.skeleton.backupBoneIsSaved ) return;
	mesh.skeleton.backupBoneIsSaved = false;
	for( var i in mesh.skeleton.bones ) {
		var b = mesh.skeleton.bones[i];
		var b2 = mesh.skeleton.backupBones[i];
		b.position.copy( b2.position );
		b.quaternion.copy( b2.quaternion );
	}
};

//------------------------------------------------------------------------------------------------------------------
MMD.EventHelper = function() {
	this.events = [];
};

MMD.EventHelper.prototype = Object.create( MMD.prototype );
MMD.EventHelper.prototype.constructor = MMD.EventHelper;

MMD.EventHelper.prototype.add = function( target, type, listener, capture ) {
	if( ! target ) return;
	for( i in this.events ) {
		var el = this.events[i];
		if( target == el.target && type == el.type ) {
			console.warn( '重複', el );
			return;
		}
	}
	var e = { target: target, type: type, listener: listener, capture: capture };
	if( ! target.hasEventListener(type, listener) ) {
		target.addEventListener( type, listener, capture );
		this.events.push( e );
		//console.log( 'Event helper add listener', e );
	} else {
		console.warn( '重複', e );
	}
};

MMD.EventHelper.prototype.remove = function( target, type, listener, capture ) {
	if( ! target ) return;
	for( i in this.events ) {
		var e = this.events[i];
		if( target == e.target && type == e.type && listener == e.listener && capture == e.capture ) {
			if( e.target.hasEventListener(e.type, e.listener) ) {
				e.target.removeEventListener( e.type, e.listener, e.capture );
				//console.log( 'Event helper del listener', e );
			} else {
				console.warn( 'can not foud listener', e );
			}
			delete this.events[i];
		}
	}
};

MMD.EventHelper.prototype.removeAtObject = function( target ) {
	if( ! target ) return;
	for( i in this.events ) {
		if( target == this.events[i].target ) {
			var e = this.events[i];
			if( e.target.hasEventListener(e.type, e.listener) ) {
				e.target.removeEventListener( e.type, e.listener, e.capture );
				delete this.events[i];
				//console.log( 'Event Helper del listener', e );
			} else {
				console.warn( 'can not foud listener', e );
			}
		}
	}
};

MMD.EventHelper.prototype.removeAtType = function( type ) {
	for( i in this.events ) {
		if( type == this.events[i].type ) {
			var e = this.events[i];
			if( e.target.hasEventListener(e.type, e.listener) ) {
				e.target.removeEventListener( e.type, e.listener, e.capture );
				delete this.events[i];
				//console.log( 'Event Helper del listener', e );
			} else {
				console.warn( 'can not foud listener', e );
			}
		}
	}
};

//------------------------------------------------------------------------------------------------------------------
MMD.GrantSolver = function( mesh ) {
	this.mesh = mesh;
};

MMD.GrantSolver.prototype = Object.create( MMD.prototype );
MMD.GrantSolver.prototype.constructor = MMD.GrantSolver;

MMD.GrantSolver.prototype.update = function() {
	var q = new THREE.Quaternion();
	return function () {
		for( var i in this.mesh.geometry.grants ) {
			var g = this.mesh.geometry.grants[i];
			var b = this.mesh.skeleton.bones[g.index];
			var pb = this.mesh.skeleton.bones[g.parentIndex];

			if( g.isLocal ) {
				// TODO: implement
				if( g.affectPosition ) {
				}
				// TODO: implement
				if( g.affectRotation ) {
				}
			} else {
				// TODO: implement
				if( g.affectPosition ) {
				}
				if( g.affectRotation ) {
					q.set( 0, 0, 0, 1 );
					q.slerp( pb.quaternion, g.ratio );
					b.quaternion.multiply( q );
				}
			}
		}
	};
};

