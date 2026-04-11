const { useState, useEffect, useRef, useCallback, useMemo } = React;
const GameScene = ({ gameState, timer, interruptionDetected, housesBuilt = 0 }) => {
    const sceneRef = useRef();
    
    const setupScene = ({ scene, camera, renderer }) => {
        console.log('Setting up 3D scene...');
        sceneRef.current = { scene, camera, renderer };
        
        try {
            // Enhanced lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
            directionalLight.position.set(15, 20, 10);
        directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 50;
            directionalLight.shadow.camera.left = -20;
            directionalLight.shadow.camera.right = 20;
            directionalLight.shadow.camera.top = 20;
            directionalLight.shadow.camera.bottom = -20;
        scene.add(directionalLight);
        
            const pointLight = new THREE.PointLight(0xffd700, 0.8, 30);
            pointLight.position.set(0, 8, 0);
        scene.add(pointLight);
        
            // Beautiful sky gradient background
            const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
            const skyMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    topColor: { value: new THREE.Color(0x87CEEB) },
                    bottomColor: { value: new THREE.Color(0x98FB98) },
                    offset: { value: 33 },
                    exponent: { value: 0.6 }
                },
                vertexShader: `
                    varying vec3 vWorldPosition;
                    void main() {
                        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                        vWorldPosition = worldPosition.xyz;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 topColor;
                    uniform vec3 bottomColor;
                    uniform float offset;
                    uniform float exponent;
                    varying vec3 vWorldPosition;
                    void main() {
                        float h = normalize(vWorldPosition + offset).y;
                        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                    }
                `,
                side: THREE.BackSide
            });
            const sky = new THREE.Mesh(skyGeometry, skyMaterial);
            scene.add(sky);
            
            // Enhanced ground with texture
            const groundGeometry = new THREE.PlaneGeometry(50, 50, 32, 32);
            const groundMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x4a9c59,
                transparent: true,
                opacity: 0.9
            });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
            ground.position.y = -0.1;
            ground.receiveShadow = true;
        scene.add(ground);
        
            // Create construction site
            createConstructionSite(scene);
            
            // Create the construction worker avatar
            createConstructionWorker(scene);
            
            // Create a beautiful castle estate (will be built in phases)
            createCastleEstate(scene);
            
            // Add enhanced decorative elements
            addEnhancedDecorations(scene);
            
            // Create village background with cottages, townhouses and castles
            createVillageBackground(scene);
            
            console.log('3D scene setup complete');
        } catch (error) {
            console.error('Error setting up 3D scene:', error);
            // Fallback: create a simple cube
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set(0, 1, 0);
            scene.add(cube);
            console.log('Fallback cube created');
        }
    };
    
    const createConstructionSite = (scene) => {
        // Construction site fence
        const fenceMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        // Fence posts around the construction area
        for (let i = 0; i < 12; i++) {
            const postGeometry = new THREE.BoxGeometry(0.15, 1.5, 0.15);
            const post = new THREE.Mesh(postGeometry, fenceMaterial);
            const angle = (i / 12) * Math.PI * 2;
            const radius = 12;
            post.position.set(
                Math.cos(angle) * radius,
                0.75,
                Math.sin(angle) * radius
            );
            post.castShadow = true;
            scene.add(post);
        }
        
        // Fence rails
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 12; j++) {
                const railGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
                const rail = new THREE.Mesh(railGeometry, fenceMaterial);
                const angle = (j / 12) * Math.PI * 2;
                const radius = 12;
                rail.position.set(
                    Math.cos(angle) * radius,
                    0.3 + i * 0.4,
                    Math.sin(angle) * radius
                );
                rail.rotation.y = angle + Math.PI / 2;
                rail.castShadow = true;
                scene.add(rail);
            }
        }
        
        // Construction materials pile
        const materialsGroup = new THREE.Group();
        
        // Bricks pile
        for (let i = 0; i < 20; i++) {
            const brickGeometry = new THREE.BoxGeometry(0.25, 0.12, 0.15);
            const brickMaterial = new THREE.MeshLambertMaterial({ color: 0xB22222 });
            const brick = new THREE.Mesh(brickGeometry, brickMaterial);
            
            brick.position.set(
                8 + (Math.random() - 0.5) * 1.5,
                0.1 + i * 0.12 + Math.random() * 0.05,
                8 + (Math.random() - 0.5) * 1.5
            );
            
            brick.rotation.y = Math.random() * 0.2;
            brick.castShadow = true;
            materialsGroup.add(brick);
        }
        
        // Cement bags
        for (let i = 0; i < 5; i++) {
            const bagGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.25);
            const bagMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const bag = new THREE.Mesh(bagGeometry, bagMaterial);
            
            bag.position.set(
                -8 + i * 0.6,
                0.3,
                8
            );
            bag.castShadow = true;
            materialsGroup.add(bag);
        }
        
        // Construction tools
        const hammerGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.6);
        const hammerMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const hammer = new THREE.Mesh(hammerGeometry, hammerMaterial);
        hammer.position.set(8.5, 0.4, 8.5);
        hammer.rotation.z = Math.PI / 4;
        hammer.castShadow = true;
        materialsGroup.add(hammer);
        
        // Level tool
        const levelGeometry = new THREE.BoxGeometry(0.8, 0.05, 0.05);
        const levelMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const level = new THREE.Mesh(levelGeometry, levelMaterial);
        level.position.set(8.8, 0.4, 8.2);
        level.castShadow = true;
        materialsGroup.add(level);
        
        // Toolbox
        const toolboxGeometry = new THREE.BoxGeometry(1, 0.5, 0.7);
        const toolboxMaterial = new THREE.MeshLambertMaterial({ color: 0xFF6B35 });
        const toolbox = new THREE.Mesh(toolboxGeometry, toolboxMaterial);
        toolbox.position.set(8.2, 0.35, 8.8);
        toolbox.castShadow = true;
        materialsGroup.add(toolbox);
        
        scene.add(materialsGroup);
        scene.userData.materialsGroup = materialsGroup;
        
        console.log('Construction site created');
    };
    
    const createConstructionWorker = (scene) => {
        const workerGroup = new THREE.Group();
        
        // Worker customization (can be linked to profile later)
        const customization = {
            skinColor: 0xFDBCB4,
            overallColor: 0x4169E1,
            hatColor: 0xFFD700,
            hairColor: 0x8B4513,
            gender: 'male'
        };
        
        // Body (overalls)
        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: customization.overallColor });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.set(0, 0.6, 0);
        body.castShadow = true;
        workerGroup.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.3);
        const headMaterial = new THREE.MeshLambertMaterial({ color: customization.skinColor });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 1.5, 0);
        head.castShadow = true;
        workerGroup.add(head);
        
        // Hard hat
        const hatGeometry = new THREE.ConeGeometry(0.35, 0.2, 8);
        const hatMaterial = new THREE.MeshLambertMaterial({ color: customization.hatColor });
        const hat = new THREE.Mesh(hatGeometry, hatMaterial);
        hat.position.set(0, 1.7, 0);
        hat.castShadow = true;
        workerGroup.add(hat);
        
        // Hair
        const hairGeometry = new THREE.SphereGeometry(0.25);
        const hairMaterial = new THREE.MeshLambertMaterial({ color: customization.hairColor });
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.set(0, 1.6, 0);
        hair.scale.set(1, 0.8, 1);
        workerGroup.add(hair);
        
        // Arms
        const armGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        const armMaterial = new THREE.MeshLambertMaterial({ color: customization.skinColor });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.5, 0.6, 0);
        leftArm.castShadow = true;
        workerGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.5, 0.6, 0);
        rightArm.castShadow = true;
        workerGroup.add(rightArm);
        
        // Legs
        const legGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const legMaterial = new THREE.MeshLambertMaterial({ color: customization.overallColor });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.2, -0.4, 0);
        leftLeg.castShadow = true;
        workerGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.2, -0.4, 0);
        rightLeg.castShadow = true;
        workerGroup.add(rightLeg);
        
        // Boots
        const bootGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.4);
        const bootMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        
        const leftBoot = new THREE.Mesh(bootGeometry, bootMaterial);
        leftBoot.position.set(-0.2, -0.9, 0);
        leftBoot.castShadow = true;
        workerGroup.add(leftBoot);
        
        const rightBoot = new THREE.Mesh(bootGeometry, bootMaterial);
        rightBoot.position.set(0.2, -0.9, 0);
        rightBoot.castShadow = true;
        workerGroup.add(rightBoot);
        
        // Tool belt
        const beltGeometry = new THREE.BoxGeometry(0.9, 0.15, 0.45);
        const beltMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const belt = new THREE.Mesh(beltGeometry, beltMaterial);
        belt.position.set(0, 0.1, 0);
        workerGroup.add(belt);
        
        // Wheelbarrow
        const wheelbarrowGroup = new THREE.Group();
        
        // Wheelbarrow body
        const wheelbarrowBodyGeometry = new THREE.BoxGeometry(1.2, 0.4, 0.8);
        const wheelbarrowBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const wheelbarrowBody = new THREE.Mesh(wheelbarrowBodyGeometry, wheelbarrowBodyMaterial);
        wheelbarrowBody.position.set(0, 0.2, 0);
        wheelbarrowBody.castShadow = true;
        wheelbarrowGroup.add(wheelbarrowBody);
        
        // Wheelbarrow handles
        const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.5);
        const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        
        const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
        leftHandle.position.set(-0.4, 0.5, -0.6);
        leftHandle.rotation.z = Math.PI / 6;
        leftHandle.castShadow = true;
        wheelbarrowGroup.add(leftHandle);
        
        const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
        rightHandle.position.set(0.4, 0.5, -0.6);
        rightHandle.rotation.z = -Math.PI / 6;
        rightHandle.castShadow = true;
        wheelbarrowGroup.add(rightHandle);
        
        // Wheelbarrow wheel
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(0, 0.3, 0.4);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wheelbarrowGroup.add(wheel);
        
        // Position wheelbarrow behind worker
        wheelbarrowGroup.position.set(0, 0, -1.5);
        workerGroup.add(wheelbarrowGroup);
        
        // Position worker at construction site
        workerGroup.position.set(6, 0, 6);
        scene.add(workerGroup);
        scene.userData.workerGroup = workerGroup;
        
        // Store movement data
        scene.userData.workerMovement = {
            time: 0,
            path: [
                { x: 6, z: 6 },   // Start position
                { x: 8, z: 4 },   // Move to materials
                { x: 4, z: 2 },   // Move to foundation
                { x: 2, z: 6 },   // Move to walls
                { x: 6, z: 8 },   // Move to towers
                { x: 6, z: 6 }    // Return to start
            ],
            currentTarget: 0,
            speed: 0.02
        };
        
        console.log('Construction worker with wheelbarrow created');
    };
    
    const createCastleEstate = (scene) => {
        const castleGroup = new THREE.Group();
        
        // Store building parts for building phases
        const buildingParts = {
            foundation: null,
            outerWalls: [],
            towers: [],
            keep: null,
            gatehouse: null,
            windows: [],
            entrance: null,
            flags: []
        };
        
        // Foundation (Phase 1) - Castle foundation
        const foundationGeometry = new THREE.BoxGeometry(8, 1, 8);
        const foundationMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2F4F4F,
            transparent: true,
            opacity: 0
        });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.set(0, 0.5, 0);
        foundation.receiveShadow = true;
        castleGroup.add(foundation);
        buildingParts.foundation = foundation;
        
        // Outer walls (Phase 2) - Castle perimeter walls
        const wallHeight = 2;
        const wallThickness = 0.5;
        
        // North wall
        const northWallGeometry = new THREE.BoxGeometry(8, wallHeight, wallThickness);
        const wallMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x708090,
            transparent: true,
            opacity: 0
        });
        const northWall = new THREE.Mesh(northWallGeometry, wallMaterial);
        northWall.position.set(0, wallHeight/2 + 1, 4);
        northWall.castShadow = true;
        castleGroup.add(northWall);
        buildingParts.outerWalls.push(northWall);
        
        // South wall
        const southWall = new THREE.Mesh(northWallGeometry, wallMaterial);
        southWall.position.set(0, wallHeight/2 + 1, -4);
        southWall.castShadow = true;
        castleGroup.add(southWall);
        buildingParts.outerWalls.push(southWall);
        
        // East wall
        const eastWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, 7);
        const eastWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
        eastWall.position.set(4, wallHeight/2 + 1, 0);
        eastWall.castShadow = true;
        castleGroup.add(eastWall);
        buildingParts.outerWalls.push(eastWall);
        
        // West wall
        const westWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
        westWall.position.set(-4, wallHeight/2 + 1, 0);
        westWall.castShadow = true;
        castleGroup.add(westWall);
        buildingParts.outerWalls.push(westWall);
        
        // Corner towers (Phase 3) - Four corner towers
        const towerHeight = 4;
        const towerRadius = 0.8;
        
        const towerPositions = [
            [3, 0, 3],   // NE
            [-3, 0, 3],  // NW
            [3, 0, -3],  // SE
            [-3, 0, -3]  // SW
        ];
        
        towerPositions.forEach((pos, index) => {
            const towerGeometry = new THREE.CylinderGeometry(towerRadius, towerRadius + 0.2, towerHeight, 8);
            const towerMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x708090,
                transparent: true,
                opacity: 0
            });
            const tower = new THREE.Mesh(towerGeometry, towerMaterial);
            tower.position.set(pos[0], towerHeight/2 + 1, pos[2]);
            tower.castShadow = true;
            castleGroup.add(tower);
            buildingParts.towers.push(tower);
            
            // Tower roof (conical)
            const roofGeometry = new THREE.ConeGeometry(towerRadius + 0.1, 1, 8);
            const roofMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x2F4F4F,
                transparent: true,
                opacity: 0
            });
            const towerRoof = new THREE.Mesh(roofGeometry, roofMaterial);
            towerRoof.position.set(pos[0], towerHeight + 1.5, pos[2]);
            towerRoof.castShadow = true;
            castleGroup.add(towerRoof);
            buildingParts.towers.push(towerRoof);
        });
        
        // Central keep (Phase 4) - Main castle building
        const keepGeometry = new THREE.BoxGeometry(4, 3, 4);
        const keepMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x708090,
            transparent: true,
            opacity: 0
        });
        const keep = new THREE.Mesh(keepGeometry, keepMaterial);
        keep.position.set(0, 2.5, 0);
        keep.castShadow = true;
        castleGroup.add(keep);
        buildingParts.keep = keep;
        
        // Keep roof
        const keepRoofGeometry = new THREE.ConeGeometry(3, 1.5, 8);
        const keepRoofMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2F4F4F,
            transparent: true,
            opacity: 0
        });
        const keepRoof = new THREE.Mesh(keepRoofGeometry, keepRoofMaterial);
        keepRoof.position.set(0, 5.25, 0);
        keepRoof.castShadow = true;
        castleGroup.add(keepRoof);
        buildingParts.keep = keepRoof;
        
        // Gatehouse (Phase 4) - Main entrance
        const gatehouseGeometry = new THREE.BoxGeometry(2, 2.5, 1);
        const gatehouseMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x708090,
            transparent: true,
            opacity: 0
        });
        const gatehouse = new THREE.Mesh(gatehouseGeometry, gatehouseMaterial);
        gatehouse.position.set(0, 2.25, 4.5);
        gatehouse.castShadow = true;
        castleGroup.add(gatehouse);
        buildingParts.gatehouse = gatehouse;
        
        // Castle windows
        const windowGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.1);
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0
        });
        
        // Keep windows
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(
                Math.cos(angle) * 2.1,
                2.5,
                Math.sin(angle) * 2.1
            );
            window.rotation.y = angle;
            castleGroup.add(window);
            buildingParts.windows.push(window);
        }
        
        // Tower windows
        towerPositions.forEach((pos, index) => {
            const towerWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            towerWindow.position.set(pos[0], 3, pos[2]);
            castleGroup.add(towerWindow);
            buildingParts.windows.push(towerWindow);
        });
        
        // Main entrance gate
        const entranceGeometry = new THREE.BoxGeometry(1.5, 2, 0.1);
        const entranceMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8B4513,
            transparent: true,
            opacity: 0
        });
        const entrance = new THREE.Mesh(entranceGeometry, entranceMaterial);
        entrance.position.set(0, 1.5, 4.6);
        castleGroup.add(entrance);
        buildingParts.entrance = entrance;
        
        // Castle flags (Phase 4)
        const flagPositions = [
            [0, 6, 0],    // Keep
            [3, 5, 3],    // NE tower
            [-3, 5, 3],   // NW tower
            [3, 5, -3],   // SE tower
            [-3, 5, -3]   // SW tower
        ];
        
        flagPositions.forEach((pos, index) => {
            const flagGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.05);
            const flagMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xFF0000,
                transparent: true,
                opacity: 0
            });
            const flag = new THREE.Mesh(flagGeometry, flagMaterial);
            flag.position.set(pos[0], pos[1], pos[2]);
            castleGroup.add(flag);
            buildingParts.flags.push(flag);
        });
        
        // Add castle to scene
        scene.add(castleGroup);
        scene.userData.houseGroup = castleGroup;
        scene.userData.houseParts = buildingParts;
        
        // Don't show castle by default - only show when not building
        console.log('Castle estate created (all parts hidden)');
    };
    
    const addEnhancedDecorations = (scene) => {
        // Create elegant estate grounds
        createEstateGrounds(scene);
        
        // Beautiful garden with flowers around the estate
        const flowerColors = [0xFF6B9D, 0xFFB6C1, 0xFF69B4, 0xDA70D6, 0x9370DB, 0xFFD700, 0xFFA500];
        const flowerGeometry = new THREE.SphereGeometry(0.15);
        
        for (let i = 0; i < 25; i++) {
            const flowerMaterial = new THREE.MeshLambertMaterial({ 
                color: flowerColors[i % flowerColors.length],
                transparent: true,
                opacity: 0.9
            });
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            const angle = (i / 25) * Math.PI * 2;
            const radius = 12 + Math.random() * 5;
            flower.position.set(
                Math.cos(angle) * radius,
                0.15,
                Math.sin(angle) * radius
            );
            flower.castShadow = true;
            scene.add(flower);
        }
        
        // Enhanced trees around the estate
        const treePositions = [
            [-12, 0, -8], [12, 0, -8], [-12, 0, 8], [12, 0, 8],
            [-8, 0, -12], [8, 0, -12], [-8, 0, 12], [8, 0, 12]
        ];
        
        treePositions.forEach((pos, index) => {
            // Tree trunk
            const treeTrunkGeometry = new THREE.CylinderGeometry(0.4, 0.5, 3);
            const treeTrunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const treeTrunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
            treeTrunk.position.set(pos[0], 1.5, pos[2]);
            treeTrunk.castShadow = true;
            scene.add(treeTrunk);
            
            // Tree leaves in layers
            const leafColors = [0x228B22, 0x32CD32, 0x90EE90];
            for (let i = 0; i < 3; i++) {
                const treeLeavesGeometry = new THREE.SphereGeometry(2 - i * 0.3);
                const treeLeavesMaterial = new THREE.MeshLambertMaterial({ 
                    color: leafColors[i],
                    transparent: true,
                    opacity: 0.8
                });
                const treeLeaves = new THREE.Mesh(treeLeavesGeometry, treeLeavesMaterial);
                treeLeaves.position.set(pos[0], 3.5 + i * 0.8, pos[2]);
                treeLeaves.castShadow = true;
                scene.add(treeLeaves);
            }
        });
        
        // Elegant stone pathways throughout the estate
        const pathGeometry = new THREE.PlaneGeometry(1.5, 20);
        const pathMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        
        // Main pathway to castle
        const mainPath = new THREE.Mesh(pathGeometry, pathMaterial);
        mainPath.rotation.x = -Math.PI / 2;
        mainPath.position.set(0, 0.01, 0);
        scene.add(mainPath);
        
        // Side pathways
        const sidePath1 = new THREE.Mesh(pathGeometry, pathMaterial);
        sidePath1.rotation.x = -Math.PI / 2;
        sidePath1.rotation.z = Math.PI / 2;
        sidePath1.position.set(0, 0.01, 0);
        scene.add(sidePath1);
        
        // Decorative stones along paths
        for (let i = 0; i < 20; i++) {
            const stoneGeometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.1);
            const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
            const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
            stone.position.set(
                (Math.random() - 0.5) * 15,
                0.1,
                (Math.random() - 0.5) * 15
            );
            scene.add(stone);
        }
        
        console.log('Elegant estate decorations added to scene');
    };
    
    const createEstateGrounds = (scene) => {
        // Create hedge fence around the entire estate
        createHedgeFence(scene);
        
        // Create bird fountain in the center of the estate
        createBirdFountain(scene);
        
        // Create spacious yard with elegant landscaping
        createSpaciousYard(scene);
    };
    
    const createHedgeFence = (scene) => {
        const hedgeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const estateRadius = 18;
        const hedgeHeight = 1.5;
        const hedgeThickness = 0.8;
        
        // Create circular hedge fence around the estate
        const segments = 32;
        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;
            
            const x1 = Math.cos(angle1) * estateRadius;
            const z1 = Math.sin(angle1) * estateRadius;
            const x2 = Math.cos(angle2) * estateRadius;
            const z2 = Math.sin(angle2) * estateRadius;
            
            const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
            const hedgeGeometry = new THREE.BoxGeometry(hedgeThickness, hedgeHeight, length);
            const hedge = new THREE.Mesh(hedgeGeometry, hedgeMaterial);
            
            const centerX = (x1 + x2) / 2;
            const centerZ = (z1 + z2) / 2;
            const rotationY = Math.atan2(z2 - z1, x2 - x1);
            
            hedge.position.set(centerX, hedgeHeight / 2, centerZ);
            hedge.rotation.y = rotationY;
            hedge.castShadow = true;
            scene.add(hedge);
        }
        
        // Add hedge gate opening
        const gateWidth = 4;
        const gateAngle = 0; // North gate
        const gateX = Math.cos(gateAngle) * estateRadius;
        const gateZ = Math.sin(gateAngle) * estateRadius;
        
        // Left gate post
        const leftPostGeometry = new THREE.CylinderGeometry(0.2, 0.2, hedgeHeight + 0.5);
        const postMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const leftPost = new THREE.Mesh(leftPostGeometry, postMaterial);
        leftPost.position.set(gateX - gateWidth/2, (hedgeHeight + 0.5) / 2, gateZ);
        leftPost.castShadow = true;
        scene.add(leftPost);
        
        // Right gate post
        const rightPost = new THREE.Mesh(leftPostGeometry, postMaterial);
        rightPost.position.set(gateX + gateWidth/2, (hedgeHeight + 0.5) / 2, gateZ);
        rightPost.castShadow = true;
        scene.add(rightPost);
        
        // Gate
        const gateGeometry = new THREE.BoxGeometry(gateWidth, hedgeHeight, 0.1);
        const gateMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const gate = new THREE.Mesh(gateGeometry, gateMaterial);
        gate.position.set(gateX, hedgeHeight / 2, gateZ);
        gate.castShadow = true;
        scene.add(gate);
    };
    
    const createBirdFountain = (scene) => {
        // Fountain base
        const fountainBaseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.5, 16);
        const fountainBaseMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const fountainBase = new THREE.Mesh(fountainBaseGeometry, fountainBaseMaterial);
        fountainBase.position.set(0, 0.25, 0);
        fountainBase.castShadow = true;
        scene.add(fountainBase);
        
        // Fountain water
        const waterGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.1, 16);
        const waterMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4682B4,
            transparent: true,
            opacity: 0.7
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.set(0, 0.6, 0);
        scene.add(water);
        
        // Fountain center pillar
        const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2);
        const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.set(0, 1.5, 0);
        pillar.castShadow = true;
        scene.add(pillar);
        
        // Bird on top
        const birdGeometry = new THREE.SphereGeometry(0.2);
        const birdMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const bird = new THREE.Mesh(birdGeometry, birdMaterial);
        bird.position.set(0, 2.7, 0);
        bird.castShadow = true;
        scene.add(bird);
        
        // Bird wings
        const wingGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.05);
        const wingMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-0.15, 2.7, 0);
        leftWing.rotation.z = Math.PI / 4;
        leftWing.castShadow = true;
        scene.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0.15, 2.7, 0);
        rightWing.rotation.z = -Math.PI / 4;
        rightWing.castShadow = true;
        scene.add(rightWing);
        
        // Decorative rings around fountain
        for (let i = 0; i < 3; i++) {
            const ringGeometry = new THREE.RingGeometry(1.5 + i * 0.3, 1.6 + i * 0.3, 16);
            const ringMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(0, 0.1 + i * 0.1, 0);
            scene.add(ring);
        }
    };
    
    const createSpaciousYard = (scene) => {
        // Create elegant garden beds around the castle
        const gardenBedPositions = [
            [6, 0, 6], [-6, 0, 6], [6, 0, -6], [-6, 0, -6],
            [0, 0, 8], [0, 0, -8], [8, 0, 0], [-8, 0, 0]
        ];
        
        gardenBedPositions.forEach((pos, index) => {
            // Garden bed border
            const bedGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 8);
            const bedMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const bed = new THREE.Mesh(bedGeometry, bedMaterial);
            bed.position.set(pos[0], 0.1, pos[2]);
            bed.castShadow = true;
            scene.add(bed);
            
            // Garden bed soil
            const soilGeometry = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 8);
            const soilMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const soil = new THREE.Mesh(soilGeometry, soilMaterial);
            soil.position.set(pos[0], 0.2, pos[2]);
            scene.add(soil);
            
            // Flowers in garden bed
            for (let i = 0; i < 8; i++) {
                const flowerGeometry = new THREE.SphereGeometry(0.1);
                const flowerColors = [0xFF6B9D, 0xFFB6C1, 0xFF69B4, 0xDA70D6];
                const flowerMaterial = new THREE.MeshLambertMaterial({ 
                    color: flowerColors[i % flowerColors.length]
                });
                const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
                
                const angle = (i / 8) * Math.PI * 2;
                const radius = 0.8;
                flower.position.set(
                    pos[0] + Math.cos(angle) * radius,
                    0.25,
                    pos[2] + Math.sin(angle) * radius
                );
                flower.castShadow = true;
                scene.add(flower);
            }
        });
        
        // Add decorative benches around the estate
        const benchPositions = [
            [10, 0, 0], [-10, 0, 0], [0, 0, 10], [0, 0, -10]
        ];
        
        benchPositions.forEach((pos, index) => {
            // Bench seat
            const seatGeometry = new THREE.BoxGeometry(2, 0.1, 0.4);
            const seatMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const seat = new THREE.Mesh(seatGeometry, seatMaterial);
            seat.position.set(pos[0], 0.5, pos[2]);
            seat.castShadow = true;
            scene.add(seat);
            
            // Bench back
            const backGeometry = new THREE.BoxGeometry(2, 0.8, 0.1);
            const backMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const back = new THREE.Mesh(backGeometry, backMaterial);
            back.position.set(pos[0], 0.9, pos[2] + 0.2);
            back.castShadow = true;
            scene.add(back);
            
            // Bench legs
            for (let i = 0; i < 4; i++) {
                const legGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
                const legMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
                const leg = new THREE.Mesh(legGeometry, legMaterial);
                const legX = pos[0] + (i % 2 === 0 ? -0.8 : 0.8);
                const legZ = pos[2] + (i < 2 ? -0.15 : 0.15);
                leg.position.set(legX, 0.25, legZ);
                leg.castShadow = true;
                scene.add(leg);
            }
        });
    };
    
    const createVillageBackground = (scene) => {
        console.log('Creating village background (progress-aware)...');
        
        // Village house positions — ordered by progression
        // Cottages first (earned 1-8), then townhouses (9-16), then castles (17-23)
        const villagePositions = [
            // Cottages (closest, earned first)
            { type: 'cottage', pos: [-18, 0, -15], scale: 1.2 },
            { type: 'cottage', pos: [-22, 0, -12], scale: 1.0 },
            { type: 'cottage', pos: [-26, 0, -18], scale: 1.3 },
            { type: 'cottage', pos: [18, 0, -14], scale: 1.1 },
            { type: 'cottage', pos: [22, 0, -17], scale: 1.0 },
            { type: 'cottage', pos: [26, 0, -21], scale: 1.2 },
            { type: 'cottage', pos: [-12, 0, -25], scale: 1.1 },
            { type: 'cottage', pos: [12, 0, -28], scale: 1.0 },

            // Townhouses (earned 9-16)
            { type: 'townhouse', pos: [-30, 0, -8], scale: 0.9 },
            { type: 'townhouse', pos: [-35, 0, -3], scale: 1.0 },
            { type: 'townhouse', pos: [30, 0, -10], scale: 0.9 },
            { type: 'townhouse', pos: [35, 0, -6], scale: 1.0 },
            { type: 'townhouse', pos: [-15, 0, 25], scale: 1.1 },
            { type: 'townhouse', pos: [15, 0, 27], scale: 1.1 },
            { type: 'townhouse', pos: [-8, 0, 30], scale: 1.0 },
            { type: 'townhouse', pos: [8, 0, 32], scale: 1.0 },

            // Castles (earned 17-23)
            { type: 'castle', pos: [-40, 0, 5], scale: 0.8 },
            { type: 'castle', pos: [40, 0, 8], scale: 0.8 },
            { type: 'castle', pos: [-10, 0, 40], scale: 0.9 },
            { type: 'castle', pos: [10, 0, 42], scale: 0.9 },
            { type: 'castle', pos: [0, 0, 45], scale: 0.7 },
            { type: 'castle', pos: [-25, 0, 35], scale: 0.8 },
            { type: 'castle', pos: [25, 0, 37], scale: 0.8 },
        ];
        
        // Create ALL houses but start them hidden (visible = false)
        const villageHouseGroups = [];
        villagePositions.forEach((house, index) => {
            const houseGroup = new THREE.Group();
            
            if (house.type === 'cottage') {
                createCottage(houseGroup, house.scale);
            } else if (house.type === 'townhouse') {
                createTownhouse(houseGroup, house.scale);
            } else if (house.type === 'castle') {
                createVillageCastle(houseGroup, house.scale);
            }
            
            houseGroup.position.set(house.pos[0], house.pos[1], house.pos[2]);
            houseGroup.castShadow = true;
            houseGroup.visible = false; // Start hidden — revealed by updateVillageVisibility
            scene.add(houseGroup);
            villageHouseGroups.push(houseGroup);
        });
        
        // Store for dynamic visibility updates
        scene.userData.villageHouses = villageHouseGroups;
        scene.userData.villagePositions = villagePositions;
        
        // Paths, decorations and lighting are always visible (they're the ground/atmosphere)
        createVillagePaths(scene);
        createVillageDecorations(scene);
        addVillageLighting(scene);

        console.log('Village background created with', villagePositions.length, 'houses (all hidden until earned)');
    };
    
    // Dynamically show/hide village houses based on housesBuilt count
    const updateVillageVisibility = (scene, count) => {
        if (!scene?.userData?.villageHouses) return;
        const houses = scene.userData.villageHouses;
        for (let i = 0; i < houses.length; i++) {
            houses[i].visible = i < count;
        }
    };
    
    // Add lighting to make village houses more visible
    const addVillageLighting = (scene) => {
        // Add ambient light for village
        const villageAmbientLight = new THREE.AmbientLight(0x404040, 0.3);
        villageAmbientLight.position.set(0, 20, 0);
        scene.add(villageAmbientLight);
        
        // Add directional light for village
        const villageDirectionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        villageDirectionalLight.position.set(50, 50, 50);
        villageDirectionalLight.target.position.set(0, 0, 0);
        villageDirectionalLight.castShadow = true;
        villageDirectionalLight.shadow.mapSize.width = 2048;
        villageDirectionalLight.shadow.mapSize.height = 2048;
        villageDirectionalLight.shadow.camera.near = 0.5;
        villageDirectionalLight.shadow.camera.far = 200;
        villageDirectionalLight.shadow.camera.left = -100;
        villageDirectionalLight.shadow.camera.right = 100;
        villageDirectionalLight.shadow.camera.top = 100;
        villageDirectionalLight.shadow.camera.bottom = -100;
        scene.add(villageDirectionalLight);
        
        // Add point lights around village for atmosphere
        const lightPositions = [
            [-30, 5, -20], [30, 5, -20], [-30, 5, 20], [30, 5, 20],
            [0, 5, -30], [0, 5, 30], [-40, 5, 0], [40, 5, 0]
        ];
        
        lightPositions.forEach((pos, index) => {
            const pointLight = new THREE.PointLight(0xffaa44, 0.5, 30);
            pointLight.position.set(pos[0], pos[1], pos[2]);
            pointLight.castShadow = true;
            pointLight.shadow.mapSize.width = 512;
            pointLight.shadow.mapSize.height = 512;
            scene.add(pointLight);
            
            // Add light glow effect
            const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xffaa44,
                transparent: true,
                opacity: 0.3
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.set(pos[0], pos[1], pos[2]);
            scene.add(glow);
        });
        
        // Add fog for atmospheric depth
        scene.fog = new THREE.Fog(0x87CEEB, 20, 80);
    };
    
    const createVillageHouse = (scene, houseType, position, scale = 1) => {
        const houseGroup = new THREE.Group();
        
        if (houseType === 'cottage') {
            createCottage(houseGroup, scale);
        } else if (houseType === 'townhouse') {
            createTownhouse(houseGroup, scale);
        } else if (houseType === 'castle') {
            createVillageCastle(houseGroup, scale);
        }
        
        houseGroup.position.set(position[0], position[1], position[2]);
        houseGroup.castShadow = true;
        scene.add(houseGroup);
    };
    
    const createCottage = (group, scale = 1) => {
        // Cottage foundation
        const foundationGeometry = new THREE.BoxGeometry(3.2 * scale, 0.3 * scale, 3.2 * scale);
        const foundationMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.set(0, 0.15 * scale, 0);
        foundation.castShadow = true;
        group.add(foundation);
        
        // Cottage base with stone texture effect
        const baseGeometry = new THREE.BoxGeometry(3 * scale, 2.2 * scale, 3 * scale);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0xE6B89C });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, 1.1 * scale, 0);
        base.castShadow = true;
        group.add(base);
        
        // Stone accent strips
        for (let i = 0; i < 3; i++) {
            const stripGeometry = new THREE.BoxGeometry(3.1 * scale, 0.1 * scale, 0.1 * scale);
            const stripMaterial = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
            const strip = new THREE.Mesh(stripGeometry, stripMaterial);
            strip.position.set(0, 0.5 + i * 0.6 * scale, 1.55 * scale);
            group.add(strip);
        }
        
        // Cottage roof with better shape
        const roofGeometry = new THREE.ConeGeometry(2.3 * scale, 1.8 * scale, 8);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, 2.9 * scale, 0);
        roof.rotation.y = Math.PI / 8;
        roof.castShadow = true;
        group.add(roof);
        
        // Roof ridge
        const ridgeGeometry = new THREE.BoxGeometry(0.1 * scale, 0.1 * scale, 4 * scale);
        const ridgeMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
        ridge.position.set(0, 3.7 * scale, 0);
        ridge.rotation.y = Math.PI / 4;
        group.add(ridge);
        
        // Main door with detailed frame
        const doorGeometry = new THREE.BoxGeometry(0.8 * scale, 1.6 * scale, 0.1 * scale);
        const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 0.8 * scale, 1.55 * scale);
        group.add(door);
        
        // Door frame with columns
        const doorFrameGeometry = new THREE.BoxGeometry(1.0 * scale, 1.8 * scale, 0.05 * scale);
        const doorFrameMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const doorFrame = new THREE.Mesh(doorFrameGeometry, doorFrameMaterial);
        doorFrame.position.set(0, 0.9 * scale, 1.6 * scale);
        group.add(doorFrame);
        
        // Door columns
        const columnGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 1.6 * scale, 8);
        const columnMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        const leftColumn = new THREE.Mesh(columnGeometry, columnMaterial);
        leftColumn.position.set(-0.4 * scale, 0.8 * scale, 1.65 * scale);
        group.add(leftColumn);
        
        const rightColumn = new THREE.Mesh(columnGeometry, columnMaterial);
        rightColumn.position.set(0.4 * scale, 0.8 * scale, 1.65 * scale);
        group.add(rightColumn);
        
        // Door handle
        const handleGeometry = new THREE.SphereGeometry(0.06 * scale);
        const handleMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(0.3 * scale, 0.8 * scale, 1.61 * scale);
        group.add(handle);
        
        // Door knocker
        const knockerGeometry = new THREE.RingGeometry(0.03 * scale, 0.05 * scale, 8);
        const knockerMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const knocker = new THREE.Mesh(knockerGeometry, knockerMaterial);
        knocker.position.set(0.2 * scale, 1.0 * scale, 1.61 * scale);
        group.add(knocker);
        
        // Windows with shutters
        const windowGeometry = new THREE.BoxGeometry(0.7 * scale, 0.8 * scale, 0.1 * scale);
        const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
        const windowFrameGeometry = new THREE.BoxGeometry(0.8 * scale, 0.9 * scale, 0.05 * scale);
        const windowFrameMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const shutterGeometry = new THREE.BoxGeometry(0.4 * scale, 0.8 * scale, 0.05 * scale);
        const shutterMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        // Left window
        const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
        leftWindow.position.set(-0.9 * scale, 1.3 * scale, 1.55 * scale);
        group.add(leftWindow);
        
        const leftWindowFrame = new THREE.Mesh(windowFrameGeometry, windowFrameMaterial);
        leftWindowFrame.position.set(-0.9 * scale, 1.3 * scale, 1.6 * scale);
        group.add(leftWindowFrame);
        
        const leftShutter = new THREE.Mesh(shutterGeometry, shutterMaterial);
        leftShutter.position.set(-1.1 * scale, 1.3 * scale, 1.6 * scale);
        group.add(leftShutter);
        
        // Right window
        const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
        rightWindow.position.set(0.9 * scale, 1.3 * scale, 1.55 * scale);
        group.add(rightWindow);
        
        const rightWindowFrame = new THREE.Mesh(windowFrameGeometry, windowFrameMaterial);
        rightWindowFrame.position.set(0.9 * scale, 1.3 * scale, 1.6 * scale);
        group.add(rightWindowFrame);
        
        const rightShutter = new THREE.Mesh(shutterGeometry, shutterMaterial);
        rightShutter.position.set(1.1 * scale, 1.3 * scale, 1.6 * scale);
        group.add(rightShutter);
        
        // Side windows
        const sideWindowGeometry = new THREE.BoxGeometry(0.5 * scale, 0.6 * scale, 0.1 * scale);
        const sideWindowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
        
        const backWindow = new THREE.Mesh(sideWindowGeometry, sideWindowMaterial);
        backWindow.position.set(0, 1.2 * scale, -1.55 * scale);
        group.add(backWindow);
        
        const leftSideWindow = new THREE.Mesh(sideWindowGeometry, sideWindowMaterial);
        leftSideWindow.position.set(-1.55 * scale, 1.2 * scale, 0);
        leftSideWindow.rotation.y = Math.PI / 2;
        group.add(leftSideWindow);
        
        const rightSideWindow = new THREE.Mesh(sideWindowGeometry, sideWindowMaterial);
        rightSideWindow.position.set(1.55 * scale, 1.2 * scale, 0);
        rightSideWindow.rotation.y = Math.PI / 2;
        group.add(rightSideWindow);
        
        // Chimney with detailed design
        const chimneyGeometry = new THREE.BoxGeometry(0.5 * scale, 1.2 * scale, 0.5 * scale);
        const chimneyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
        const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
        chimney.position.set(1.3 * scale, 2.4 * scale, -0.9 * scale);
        group.add(chimney);
        
        // Chimney cap
        const capGeometry = new THREE.BoxGeometry(0.6 * scale, 0.1 * scale, 0.6 * scale);
        const capMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.position.set(1.3 * scale, 3.0 * scale, -0.9 * scale);
        group.add(cap);
        
        // Smoke particles with better animation
        for (let i = 0; i < 5; i++) {
            const smokeGeometry = new THREE.SphereGeometry(0.08 * scale * (1 - i * 0.15));
            const smokeMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xCCCCCC,
                transparent: true,
                opacity: 0.7 - i * 0.12
            });
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            smoke.position.set(
                1.3 * scale + (Math.random() - 0.5) * 0.3 * scale,
                3.1 * scale + i * 0.4 * scale,
                -0.9 * scale + (Math.random() - 0.5) * 0.3 * scale
            );
            group.add(smoke);
        }
        
        // Flower garden with more variety
        const flowerPositions = [
            [1.5, 0, 1.5], [-1.5, 0, 1.5], [1.5, 0, -1.5], [-1.5, 0, -1.5],
            [0, 0, 2], [2, 0, 0], [0, 0, -2], [-2, 0, 0]
        ];
        
        flowerPositions.forEach((pos, index) => {
            const flowerGeometry = new THREE.SphereGeometry(0.06 * scale);
            const flowerColors = [0xFF6B9D, 0xFFB6C1, 0xFF69B4, 0xDA70D6, 0x90EE90, 0xFFD700, 0xFF6347];
            const flowerMaterial = new THREE.MeshLambertMaterial({ 
                color: flowerColors[index % flowerColors.length]
            });
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flower.position.set(pos[0] * scale, 0.08 * scale, pos[2] * scale);
            group.add(flower);
            
            // Flower stems
            const stemGeometry = new THREE.CylinderGeometry(0.01 * scale, 0.01 * scale, 0.1 * scale, 4);
            const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            stem.position.set(pos[0] * scale, 0.05 * scale, pos[2] * scale);
            group.add(stem);
        });
        
        // Decorative fence with rails
        for (let i = 0; i < 12; i++) {
            const fencePostGeometry = new THREE.BoxGeometry(0.08 * scale, 0.7 * scale, 0.08 * scale);
            const fencePostMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const fencePost = new THREE.Mesh(fencePostGeometry, fencePostMaterial);
            
            const angle = (i / 12) * Math.PI * 2;
            const radius = 2.3 * scale;
            fencePost.position.set(
                Math.cos(angle) * radius,
                0.35 * scale,
                Math.sin(angle) * radius
            );
            group.add(fencePost);
            
            // Fence rails
            if (i < 12) {
                const railGeometry = new THREE.BoxGeometry(0.05 * scale, 0.05 * scale, 0.4 * scale);
                const railMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
                const rail = new THREE.Mesh(railGeometry, railMaterial);
                
                const nextAngle = ((i + 1) / 12) * Math.PI * 2;
                const nextX = Math.cos(nextAngle) * radius;
                const nextZ = Math.sin(nextAngle) * radius;
                const currentX = Math.cos(angle) * radius;
                const currentZ = Math.sin(angle) * radius;
                
                rail.position.set(
                    (currentX + nextX) / 2,
                    0.2 * scale,
                    (currentZ + nextZ) / 2
                );
                rail.rotation.y = angle + Math.PI / 12;
                group.add(rail);
            }
        }
        
        // Garden path
        const pathGeometry = new THREE.PlaneGeometry(1.5 * scale, 0.3 * scale);
        const pathMaterial = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
        const path = new THREE.Mesh(pathGeometry, pathMaterial);
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0.01 * scale, 2.5 * scale);
        group.add(path);
        
        // Mailbox
        const mailboxGeometry = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.4 * scale, 8);
        const mailboxMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const mailbox = new THREE.Mesh(mailboxGeometry, mailboxMaterial);
        mailbox.position.set(1.8 * scale, 0.2 * scale, 1.8 * scale);
        group.add(mailbox);
        
        const mailboxBoxGeometry = new THREE.BoxGeometry(0.2 * scale, 0.15 * scale, 0.1 * scale);
        const mailboxBoxMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        const mailboxBox = new THREE.Mesh(mailboxBoxGeometry, mailboxBoxMaterial);
        mailboxBox.position.set(1.8 * scale, 0.5 * scale, 1.8 * scale);
        group.add(mailboxBox);
    };
    
    const createTownhouse = (group, scale = 1) => {
        // Foundation
        const foundationGeometry = new THREE.BoxGeometry(4.2 * scale, 0.4 * scale, 3.7 * scale);
        const foundationMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.set(0, 0.2 * scale, 0);
        foundation.castShadow = true;
        group.add(foundation);
        
        // First floor with brick pattern
        const firstFloorGeometry = new THREE.BoxGeometry(4 * scale, 2.8 * scale, 3.5 * scale);
        const firstFloorMaterial = new THREE.MeshLambertMaterial({ color: 0xD2B48C });
        const firstFloor = new THREE.Mesh(firstFloorGeometry, firstFloorMaterial);
        firstFloor.position.set(0, 1.4 * scale, 0);
        firstFloor.castShadow = true;
        group.add(firstFloor);
        
        // Brick pattern strips
        for (let i = 0; i < 4; i++) {
            const stripGeometry = new THREE.BoxGeometry(4.1 * scale, 0.08 * scale, 0.1 * scale);
            const stripMaterial = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
            const strip = new THREE.Mesh(stripGeometry, stripMaterial);
            strip.position.set(0, 0.3 + i * 0.6 * scale, 1.8 * scale);
            group.add(strip);
        }
        
        // Second floor with different color
        const secondFloorGeometry = new THREE.BoxGeometry(3.6 * scale, 2.8 * scale, 3.2 * scale);
        const secondFloorMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
        const secondFloor = new THREE.Mesh(secondFloorGeometry, secondFloorMaterial);
        secondFloor.position.set(0, 4.2 * scale, 0);
        secondFloor.castShadow = true;
        group.add(secondFloor);
        
        // Third floor (attic)
        const thirdFloorGeometry = new THREE.BoxGeometry(3.2 * scale, 1.5 * scale, 2.8 * scale);
        const thirdFloorMaterial = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 });
        const thirdFloor = new THREE.Mesh(thirdFloorGeometry, thirdFloorMaterial);
        thirdFloor.position.set(0, 6.15 * scale, 0);
        thirdFloor.castShadow = true;
        group.add(thirdFloor);
        
        // Slanted roof
        const roofGeometry = new THREE.BoxGeometry(4.2 * scale, 0.4 * scale, 3.7 * scale);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, 7.1 * scale, 0);
        roof.rotation.x = -Math.PI / 12;
        roof.castShadow = true;
        group.add(roof);
        
        // Roof ridge
        const ridgeGeometry = new THREE.BoxGeometry(0.1 * scale, 0.1 * scale, 4.5 * scale);
        const ridgeMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
        ridge.position.set(0, 7.3 * scale, 0);
        group.add(ridge);
        
        // Balcony on second floor with detailed railing
        const balconyGeometry = new THREE.BoxGeometry(2.5 * scale, 0.15 * scale, 1.2 * scale);
        const balconyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
        balcony.position.set(0, 2.8 * scale, 1.6 * scale);
        group.add(balcony);
        
        // Balcony railing with posts
        for (let i = 0; i < 8; i++) {
            const railingGeometry = new THREE.BoxGeometry(0.06 * scale, 0.5 * scale, 0.06 * scale);
            const railingMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
            const railing = new THREE.Mesh(railingGeometry, railingMaterial);
            railing.position.set(
                -1.0 * scale + (i * 0.28 * scale),
                3.05 * scale,
                1.6 * scale
            );
            group.add(railing);
            
            // Horizontal rails
            if (i < 7) {
                const horizontalRailGeometry = new THREE.BoxGeometry(0.04 * scale, 0.04 * scale, 0.3 * scale);
                const horizontalRailMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                const horizontalRail = new THREE.Mesh(horizontalRailGeometry, horizontalRailMaterial);
                horizontalRail.position.set(
                    -0.86 * scale + (i * 0.28 * scale),
                    2.9 * scale,
                    1.6 * scale
                );
                group.add(horizontalRail);
            }
        }
        
        // Main door with detailed entrance
        const doorGeometry = new THREE.BoxGeometry(0.9 * scale, 2.2 * scale, 0.1 * scale);
        const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const mainDoor = new THREE.Mesh(doorGeometry, doorMaterial);
        mainDoor.position.set(0, 1.4 * scale, 1.8 * scale);
        group.add(mainDoor);
        
        // Door frame with columns
        const doorFrameGeometry = new THREE.BoxGeometry(1.1 * scale, 2.4 * scale, 0.05 * scale);
        const doorFrameMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const doorFrame = new THREE.Mesh(doorFrameGeometry, doorFrameMaterial);
        doorFrame.position.set(0, 1.5 * scale, 1.85 * scale);
        group.add(doorFrame);
        
        // Door columns
        const columnGeometry = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 2.2 * scale, 8);
        const columnMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        
        const leftColumn = new THREE.Mesh(columnGeometry, columnMaterial);
        leftColumn.position.set(-0.45 * scale, 1.4 * scale, 1.9 * scale);
        group.add(leftColumn);
        
        const rightColumn = new THREE.Mesh(columnGeometry, columnMaterial);
        rightColumn.position.set(0.45 * scale, 1.4 * scale, 1.9 * scale);
        group.add(rightColumn);
        
        // Door handle and knocker
        const handleGeometry = new THREE.SphereGeometry(0.06 * scale);
        const handleMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(0.35 * scale, 1.4 * scale, 1.86 * scale);
        group.add(handle);
        
        const knockerGeometry = new THREE.RingGeometry(0.04 * scale, 0.06 * scale, 8);
        const knockerMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const knocker = new THREE.Mesh(knockerGeometry, knockerMaterial);
        knocker.position.set(0.25 * scale, 1.6 * scale, 1.86 * scale);
        group.add(knocker);
        
        // Windows with shutters and detailed frames
        const windowGeometry = new THREE.BoxGeometry(0.8 * scale, 1.0 * scale, 0.1 * scale);
        const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
        const windowFrameGeometry = new THREE.BoxGeometry(0.9 * scale, 1.1 * scale, 0.05 * scale);
        const windowFrameMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const shutterGeometry = new THREE.BoxGeometry(0.45 * scale, 1.0 * scale, 0.05 * scale);
        const shutterMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        // First floor windows
        for (let i = 0; i < 4; i++) {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            const windowFrame = new THREE.Mesh(windowFrameGeometry, windowFrameMaterial);
            const shutter = new THREE.Mesh(shutterGeometry, shutterMaterial);
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.cos(angle) * 1.9 * scale;
            const z = Math.sin(angle) * 1.9 * scale;
            
            window.position.set(x, 1.4 * scale, z);
            window.rotation.y = angle;
            group.add(window);
            
            windowFrame.position.set(x, 1.4 * scale, z + 0.05 * Math.sin(angle));
            windowFrame.rotation.y = angle;
            group.add(windowFrame);
            
            shutter.position.set(x + 0.1 * Math.cos(angle), 1.4 * scale, z + 0.1 * Math.sin(angle));
            shutter.rotation.y = angle;
            group.add(shutter);
        }
        
        // Second floor windows
        for (let i = 0; i < 4; i++) {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            const windowFrame = new THREE.Mesh(windowFrameGeometry, windowFrameMaterial);
            const shutter = new THREE.Mesh(shutterGeometry, shutterMaterial);
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.cos(angle) * 1.5 * scale;
            const z = Math.sin(angle) * 1.5 * scale;
            
            window.position.set(x, 4.2 * scale, z);
            window.rotation.y = angle;
            group.add(window);
            
            windowFrame.position.set(x, 4.2 * scale, z + 0.05 * Math.sin(angle));
            windowFrame.rotation.y = angle;
            group.add(windowFrame);
            
            shutter.position.set(x + 0.1 * Math.cos(angle), 4.2 * scale, z + 0.1 * Math.sin(angle));
            shutter.rotation.y = angle;
            group.add(shutter);
        }
        
        // Attic windows (smaller)
        const atticWindowGeometry = new THREE.BoxGeometry(0.6 * scale, 0.8 * scale, 0.1 * scale);
        const atticWindowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
        
        for (let i = 0; i < 2; i++) {
            const atticWindow = new THREE.Mesh(atticWindowGeometry, atticWindowMaterial);
            atticWindow.position.set(
                -0.8 + i * 1.6 * scale,
                6.15 * scale,
                1.4 * scale
            );
            group.add(atticWindow);
        }
        
        // Chimney with detailed design
        const chimneyGeometry = new THREE.BoxGeometry(0.4 * scale, 1.5 * scale, 0.4 * scale);
        const chimneyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
        chimney.position.set(1.6 * scale, 7.5 * scale, -1.4 * scale);
        group.add(chimney);
        
        // Chimney cap
        const capGeometry = new THREE.BoxGeometry(0.5 * scale, 0.15 * scale, 0.5 * scale);
        const capMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.position.set(1.6 * scale, 8.25 * scale, -1.4 * scale);
        group.add(cap);
        
        // Steps leading to door with handrails
        for (let i = 0; i < 4; i++) {
            const stepGeometry = new THREE.BoxGeometry(2.0 * scale, 0.12 * scale, 0.4 * scale);
            const stepMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
            const step = new THREE.Mesh(stepGeometry, stepMaterial);
            step.position.set(0, 0.06 + i * 0.12 * scale, 2.4 + i * 0.25 * scale);
            group.add(step);
            
            // Step handrails
            if (i > 0) {
                const handrailGeometry = new THREE.BoxGeometry(0.04 * scale, 0.3 * scale, 0.04 * scale);
                const handrailMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                
                const leftHandrail = new THREE.Mesh(handrailGeometry, handrailMaterial);
                leftHandrail.position.set(-0.8 * scale, 0.2 + i * 0.12 * scale, 2.4 + i * 0.25 * scale);
                group.add(leftHandrail);
                
                const rightHandrail = new THREE.Mesh(handrailGeometry, handrailMaterial);
                rightHandrail.position.set(0.8 * scale, 0.2 + i * 0.12 * scale, 2.4 + i * 0.25 * scale);
                group.add(rightHandrail);
            }
        }
        
        // Front garden with variety
        const gardenPositions = [
            [1.5, 0, 2.8], [-1.5, 0, 2.8], [0.8, 0, 3.2], [-0.8, 0, 3.2],
            [2.2, 0, 1.5], [-2.2, 0, 1.5], [2.2, 0, -1.5], [-2.2, 0, -1.5]
        ];
        
        gardenPositions.forEach((pos, index) => {
            const flowerGeometry = new THREE.SphereGeometry(0.05 * scale);
            const flowerColors = [0xFF6B9D, 0xFFB6C1, 0x90EE90, 0x87CEEB, 0xFFD700, 0xFF6347, 0xDA70D6];
            const flowerMaterial = new THREE.MeshLambertMaterial({ 
                color: flowerColors[index % flowerColors.length]
            });
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flower.position.set(pos[0] * scale, 0.06 * scale, pos[2] * scale);
            group.add(flower);
            
            // Flower stems
            const stemGeometry = new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, 0.12 * scale, 4);
            const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            stem.position.set(pos[0] * scale, 0.06 * scale, pos[2] * scale);
            group.add(stem);
        });
        
        // Small trees
        for (let i = 0; i < 3; i++) {
            const treePositions = [[2.5, 0, 2.5], [-2.5, 0, 2.5], [0, 0, -2.5]];
            const pos = treePositions[i];
            
            // Tree trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 0.8 * scale, 8);
            const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(pos[0] * scale, 0.4 * scale, pos[2] * scale);
            group.add(trunk);
            
            // Tree foliage
            const foliageGeometry = new THREE.SphereGeometry(0.3 * scale, 8, 6);
            const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.set(pos[0] * scale, 0.9 * scale, pos[2] * scale);
            group.add(foliage);
        }
        
        // Street lamp
        const lampPostGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 1.2 * scale, 8);
        const lampPostMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        const lampPost = new THREE.Mesh(lampPostGeometry, lampPostMaterial);
        lampPost.position.set(2.8 * scale, 0.6 * scale, 1.5 * scale);
        group.add(lampPost);
        
        const lampGeometry = new THREE.SphereGeometry(0.15 * scale, 8, 6);
        const lampMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFFF99,
            emissive: 0xFFFF99,
            emissiveIntensity: 0.3
        });
        const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
        lamp.position.set(2.8 * scale, 1.2 * scale, 1.5 * scale);
        group.add(lamp);
    };
    
    const createVillageCastle = (group, scale = 1) => {
        // Main keep
        const keepGeometry = new THREE.BoxGeometry(3 * scale, 4 * scale, 3 * scale);
        const keepMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const keep = new THREE.Mesh(keepGeometry, keepMaterial);
        keep.position.set(0, 2 * scale, 0);
        keep.castShadow = true;
        group.add(keep);
        
        // Keep roof
        const keepRoofGeometry = new THREE.ConeGeometry(2.2 * scale, 1.5 * scale, 8);
        const keepRoofMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        const keepRoof = new THREE.Mesh(keepRoofGeometry, keepRoofMaterial);
        keepRoof.position.set(0, 5.25 * scale, 0);
        keepRoof.castShadow = true;
        group.add(keepRoof);
        
        // Corner towers
        const towerPositions = [
            [2.5 * scale, 0, 2.5 * scale],
            [-2.5 * scale, 0, 2.5 * scale],
            [2.5 * scale, 0, -2.5 * scale],
            [-2.5 * scale, 0, -2.5 * scale]
        ];
        
        towerPositions.forEach((pos, index) => {
            const towerGeometry = new THREE.CylinderGeometry(0.6 * scale, 0.6 * scale, 3 * scale, 8);
            const towerMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
            const tower = new THREE.Mesh(towerGeometry, towerMaterial);
            tower.position.set(pos[0], 1.5 * scale, pos[2]);
            tower.castShadow = true;
            group.add(tower);
            
            // Tower roof
            const towerRoofGeometry = new THREE.ConeGeometry(0.7 * scale, 0.8 * scale, 8);
            const towerRoofMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
            const towerRoof = new THREE.Mesh(towerRoofGeometry, towerRoofMaterial);
            towerRoof.position.set(pos[0], 3.4 * scale, pos[2]);
            towerRoof.castShadow = true;
            group.add(towerRoof);
            
            // Tower windows
            const towerWindowGeometry = new THREE.BoxGeometry(0.3 * scale, 0.4 * scale, 0.1 * scale);
            const towerWindowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
            const towerWindow = new THREE.Mesh(towerWindowGeometry, towerWindowMaterial);
            towerWindow.position.set(pos[0], 2.5 * scale, pos[2] + 0.65 * scale);
            group.add(towerWindow);
        });
        
        // Castle walls
        const wallPositions = [
            [0, 0, 3.5 * scale], // North
            [0, 0, -3.5 * scale], // South
            [3.5 * scale, 0, 0], // East
            [-3.5 * scale, 0, 0] // West
        ];
        
        wallPositions.forEach((pos, index) => {
            const wallGeometry = new THREE.BoxGeometry(1 * scale, 2 * scale, 0.3 * scale);
            const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(pos[0], 1 * scale, pos[2]);
            wall.castShadow = true;
            group.add(wall);
        });
        
        // Castle gate
        const gateGeometry = new THREE.BoxGeometry(1.2 * scale, 2.5 * scale, 0.2 * scale);
        const gateMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const gate = new THREE.Mesh(gateGeometry, gateMaterial);
        gate.position.set(0, 1.25 * scale, 3.6 * scale);
        group.add(gate);
        
        // Gate arch
        const archGeometry = new THREE.CylinderGeometry(0.7 * scale, 0.7 * scale, 0.3 * scale, 8);
        const archMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const arch = new THREE.Mesh(archGeometry, archMaterial);
        arch.position.set(0, 2.5 * scale, 3.6 * scale);
        arch.rotation.x = Math.PI / 2;
        group.add(arch);
        
        // Castle flags on towers
        const flagGeometry = new THREE.BoxGeometry(0.6 * scale, 0.4 * scale, 0.05 * scale);
        const flagMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        
        // Main keep flag
        const mainFlag = new THREE.Mesh(flagGeometry, flagMaterial);
        mainFlag.position.set(0, 6 * scale, 0);
        group.add(mainFlag);
        
        // Tower flags
        towerPositions.forEach((pos, index) => {
            const towerFlag = new THREE.Mesh(flagGeometry, flagMaterial);
            towerFlag.position.set(pos[0], 4.2 * scale, pos[2]);
            group.add(towerFlag);
        });
        
        // Castle windows
        const windowGeometry = new THREE.BoxGeometry(0.4 * scale, 0.6 * scale, 0.1 * scale);
        const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
        
        // Keep windows
        for (let i = 0; i < 4; i++) {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            const angle = (i / 4) * Math.PI * 2;
            window.position.set(
                Math.cos(angle) * 1.6 * scale,
                2.5 * scale,
                Math.sin(angle) * 1.6 * scale
            );
            window.rotation.y = angle;
            group.add(window);
        }
        
        // Moat around castle
        const moatGeometry = new THREE.CylinderGeometry(4.5 * scale, 4.5 * scale, 0.3 * scale, 16);
        const moatMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4682B4,
            transparent: true,
            opacity: 0.7
        });
        const moat = new THREE.Mesh(moatGeometry, moatMaterial);
        moat.position.set(0, 0.15 * scale, 0);
        group.add(moat);
        
        // Drawbridge
        const drawbridgeGeometry = new THREE.BoxGeometry(1.5 * scale, 0.1 * scale, 0.3 * scale);
        const drawbridgeMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const drawbridge = new THREE.Mesh(drawbridgeGeometry, drawbridgeMaterial);
        drawbridge.position.set(0, 0.05 * scale, 4.8 * scale);
        drawbridge.rotation.x = -Math.PI / 6;
        group.add(drawbridge);
        
        // Castle courtyard
        const courtyardGeometry = new THREE.CylinderGeometry(2 * scale, 2 * scale, 0.1 * scale, 8);
        const courtyardMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
        const courtyard = new THREE.Mesh(courtyardGeometry, courtyardMaterial);
        courtyard.position.set(0, 0.05 * scale, 0);
        group.add(courtyard);
        
        // Courtyard fountain with water
        const fountainGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 0.4 * scale, 8);
        const fountainMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const fountain = new THREE.Mesh(fountainGeometry, fountainMaterial);
        fountain.position.set(0, 0.3 * scale, 0);
        group.add(fountain);
        
        // Fountain water
        const waterGeometry = new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 0.1 * scale, 8);
        const waterMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4682B4,
            transparent: true,
            opacity: 0.8
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.set(0, 0.5 * scale, 0);
        group.add(water);
        
        // Fountain decorations
        for (let i = 0; i < 4; i++) {
            const decorationGeometry = new THREE.SphereGeometry(0.05 * scale);
            const decorationMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
            const decoration = new THREE.Mesh(decorationGeometry, decorationMaterial);
            const angle = (i / 4) * Math.PI * 2;
            decoration.position.set(
                Math.cos(angle) * 0.2 * scale,
                0.6 * scale,
                Math.sin(angle) * 0.2 * scale
            );
            group.add(decoration);
        }
        
        // Castle banners on walls
        for (let i = 0; i < 4; i++) {
            const bannerGeometry = new THREE.BoxGeometry(0.3 * scale, 0.4 * scale, 0.02 * scale);
            const bannerMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
            const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
            const angle = (i / 4) * Math.PI * 2;
            banner.position.set(
                Math.cos(angle) * 3.2 * scale,
                1.5 * scale,
                Math.sin(angle) * 3.2 * scale
            );
            banner.rotation.y = angle;
            group.add(banner);
        }
        
        // Castle torches
        for (let i = 0; i < 8; i++) {
            const torchGeometry = new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.3 * scale, 6);
            const torchMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const torch = new THREE.Mesh(torchGeometry, torchMaterial);
            const angle = (i / 8) * Math.PI * 2;
            torch.position.set(
                Math.cos(angle) * 2.8 * scale,
                0.15 * scale,
                Math.sin(angle) * 2.8 * scale
            );
            group.add(torch);
            
            // Torch flame
            const flameGeometry = new THREE.SphereGeometry(0.08 * scale, 6, 4);
            const flameMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xFF4500,
                emissive: 0xFF4500,
                emissiveIntensity: 0.5
            });
            const flame = new THREE.Mesh(flameGeometry, flameMaterial);
            flame.position.set(
                Math.cos(angle) * 2.8 * scale,
                0.35 * scale,
                Math.sin(angle) * 2.8 * scale
            );
            group.add(flame);
        }
        
        // Castle garden with herbs and flowers
        const gardenPositions = [
            [1.5, 0, 1.5], [-1.5, 0, 1.5], [1.5, 0, -1.5], [-1.5, 0, -1.5],
            [0, 0, 2], [2, 0, 0], [0, 0, -2], [-2, 0, 0],
            [0.8, 0, 0.8], [-0.8, 0, 0.8], [0.8, 0, -0.8], [-0.8, 0, -0.8]
        ];
        
        gardenPositions.forEach((pos, index) => {
            const flowerGeometry = new THREE.SphereGeometry(0.04 * scale);
            const flowerColors = [0xFF6B9D, 0xFFB6C1, 0x90EE90, 0x87CEEB, 0xFFD700, 0xFF6347, 0xDA70D6, 0x9370DB];
            const flowerMaterial = new THREE.MeshLambertMaterial({ 
                color: flowerColors[index % flowerColors.length]
            });
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flower.position.set(pos[0] * scale, 0.04 * scale, pos[2] * scale);
            group.add(flower);
            
            // Flower stems
            const stemGeometry = new THREE.CylinderGeometry(0.006 * scale, 0.006 * scale, 0.08 * scale, 4);
            const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            stem.position.set(pos[0] * scale, 0.04 * scale, pos[2] * scale);
            group.add(stem);
        });
        
        // Castle well
        const wellGeometry = new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 0.3 * scale, 8);
        const wellMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const well = new THREE.Mesh(wellGeometry, wellMaterial);
        well.position.set(1.5 * scale, 0.15 * scale, 1.5 * scale);
        group.add(well);
        
        // Well roof
        const wellRoofGeometry = new THREE.ConeGeometry(0.25 * scale, 0.2 * scale, 8);
        const wellRoofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const wellRoof = new THREE.Mesh(wellRoofGeometry, wellRoofMaterial);
        wellRoof.position.set(1.5 * scale, 0.4 * scale, 1.5 * scale);
        group.add(wellRoof);
        
        // Well bucket
        const bucketGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.08 * scale, 8);
        const bucketMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const bucket = new THREE.Mesh(bucketGeometry, bucketMaterial);
        bucket.position.set(1.5 * scale, 0.25 * scale, 1.5 * scale);
        group.add(bucket);
    };
    
    const createVillagePaths = (scene) => {
        // Create stone paths connecting village houses (more visible)
        const pathMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        
        // Main village road (wider and more visible)
        const mainRoadGeometry = new THREE.PlaneGeometry(4, 120);
        const mainRoad = new THREE.Mesh(mainRoadGeometry, pathMaterial);
        mainRoad.rotation.x = -Math.PI / 2;
        mainRoad.position.set(0, 0.01, 0);
        scene.add(mainRoad);
        
        // Cross roads (wider)
        const crossRoadGeometry = new THREE.PlaneGeometry(120, 4);
        const crossRoad = new THREE.Mesh(crossRoadGeometry, pathMaterial);
        crossRoad.rotation.x = -Math.PI / 2;
        crossRoad.position.set(0, 0.01, 0);
        scene.add(crossRoad);
        
        // Side paths (more visible)
        for (let i = 0; i < 12; i++) {
            const sidePathGeometry = new THREE.PlaneGeometry(2, 25);
            const sidePath = new THREE.Mesh(sidePathGeometry, pathMaterial);
            sidePath.rotation.x = -Math.PI / 2;
            const angle = (i / 12) * Math.PI * 2;
            const radius = 25;
            sidePath.position.set(
                Math.cos(angle) * radius,
                0.01,
                Math.sin(angle) * radius
            );
            sidePath.rotation.z = angle;
            scene.add(sidePath);
        }
        
        // Add path borders for better visibility
        const borderMaterial = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
        
        // Main road borders
        const leftBorderGeometry = new THREE.PlaneGeometry(0.3, 120);
        const leftBorder = new THREE.Mesh(leftBorderGeometry, borderMaterial);
        leftBorder.rotation.x = -Math.PI / 2;
        leftBorder.position.set(-2.15, 0.02, 0);
        scene.add(leftBorder);
        
        const rightBorderGeometry = new THREE.PlaneGeometry(0.3, 120);
        const rightBorder = new THREE.Mesh(rightBorderGeometry, borderMaterial);
        rightBorder.rotation.x = -Math.PI / 2;
        rightBorder.position.set(2.15, 0.02, 0);
        scene.add(rightBorder);
        
        // Cross road borders
        const topBorderGeometry = new THREE.PlaneGeometry(120, 0.3);
        const topBorder = new THREE.Mesh(topBorderGeometry, borderMaterial);
        topBorder.rotation.x = -Math.PI / 2;
        topBorder.position.set(0, 0.02, 2.15);
        scene.add(topBorder);
        
        const bottomBorderGeometry = new THREE.PlaneGeometry(120, 0.3);
        const bottomBorder = new THREE.Mesh(bottomBorderGeometry, borderMaterial);
        bottomBorder.rotation.x = -Math.PI / 2;
        bottomBorder.position.set(0, 0.02, -2.15);
        scene.add(bottomBorder);
    };
    
    const createVillageDecorations = (scene) => {
        // Add trees around the village
        const treePositions = [
            [-60, 0, -30], [60, 0, -30], [-60, 0, 30], [60, 0, 30],
            [-40, 0, -40], [40, 0, -40], [-40, 0, 40], [40, 0, 40],
            [0, 0, -60], [0, 0, 60], [-30, 0, 0], [30, 0, 0]
        ];
        
        treePositions.forEach((pos, index) => {
            // Tree trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2);
            const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(pos[0], 1, pos[2]);
            trunk.castShadow = true;
            scene.add(trunk);
            
            // Tree leaves
            const leavesGeometry = new THREE.SphereGeometry(1.5);
            const leavesMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x228B22,
                transparent: true,
                opacity: 0.8
            });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.set(pos[0], 2.8, pos[2]);
            leaves.castShadow = true;
            scene.add(leaves);
        });
        
        // Add village well
        const wellGeometry = new THREE.CylinderGeometry(1, 1, 1);
        const wellMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const well = new THREE.Mesh(wellGeometry, wellMaterial);
        well.position.set(0, 0.5, 25);
        well.castShadow = true;
        scene.add(well);
        
        // Well roof
        const wellRoofGeometry = new THREE.ConeGeometry(1.5, 0.8, 8);
        const wellRoofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const wellRoof = new THREE.Mesh(wellRoofGeometry, wellRoofMaterial);
        wellRoof.position.set(0, 1.4, 25);
        wellRoof.castShadow = true;
        scene.add(wellRoof);
    };
    
    // Show completed castle (for background display)
    const showCompletedCastle = (buildingParts) => {
        if (!buildingParts) return;
        
        console.log('Showing completed castle in background');
        
        // Show all building parts
        if (buildingParts.foundation) buildingParts.foundation.material.opacity = 1;
        if (buildingParts.outerWalls) {
            buildingParts.outerWalls.forEach(wall => {
                if (wall) wall.material.opacity = 1;
            });
        }
        if (buildingParts.towers) {
            buildingParts.towers.forEach(tower => {
                if (tower) tower.material.opacity = 1;
            });
        }
        if (buildingParts.keep) buildingParts.keep.material.opacity = 1;
        if (buildingParts.gatehouse) buildingParts.gatehouse.material.opacity = 1;
        
        if (buildingParts.windows) {
            buildingParts.windows.forEach(window => {
                if (window) window.material.opacity = 1;
            });
        }
        
        if (buildingParts.entrance) buildingParts.entrance.material.opacity = 1;
        if (buildingParts.flags) {
            buildingParts.flags.forEach(flag => {
                if (flag) flag.material.opacity = 1;
            });
        }
    };
    
    // Hide castle for progressive building
    const hideCastle = (buildingParts) => {
        if (!buildingParts) return;
        
        console.log('Hiding castle for progressive building');
        
        // Hide all building parts
        if (buildingParts.foundation) buildingParts.foundation.material.opacity = 0;
        if (buildingParts.outerWalls) {
            buildingParts.outerWalls.forEach(wall => {
                if (wall) wall.material.opacity = 0;
            });
        }
        if (buildingParts.towers) {
            buildingParts.towers.forEach(tower => {
                if (tower) tower.material.opacity = 0;
            });
        }
        if (buildingParts.keep) buildingParts.keep.material.opacity = 0;
        if (buildingParts.gatehouse) buildingParts.gatehouse.material.opacity = 0;
        
        if (buildingParts.windows) {
            buildingParts.windows.forEach(window => {
                if (window) window.material.opacity = 0;
            });
        }
        
        if (buildingParts.entrance) buildingParts.entrance.material.opacity = 0;
        if (buildingParts.flags) {
            buildingParts.flags.forEach(flag => {
                if (flag) flag.material.opacity = 0;
            });
        }
    };
    
    // Castle building phases
    const buildPhase = (phase, buildingParts) => {
        if (!buildingParts) {
            console.log('No building parts available for building phase', phase);
            return;
        }
        
        console.log(`Building phase ${phase} - Building parts:`, buildingParts);
        
        switch (phase) {
            case 1: // Foundation
                if (buildingParts.foundation) {
                    buildingParts.foundation.material.opacity = 1;
                    console.log('Castle foundation built!');
                }
                break;
            case 2: // Outer walls
                if (buildingParts.outerWalls) {
                    buildingParts.outerWalls.forEach(wall => {
                        if (wall) wall.material.opacity = 1;
                    });
                    console.log('Outer walls built!');
                }
                break;
            case 3: // Corner towers
                if (buildingParts.towers) {
                    buildingParts.towers.forEach(tower => {
                        if (tower) tower.material.opacity = 1;
                    });
                    console.log('Corner towers built!');
                }
                break;
            case 4: // Keep, gatehouse, and finishing
                if (buildingParts.keep) {
                    buildingParts.keep.material.opacity = 1;
                    console.log('Central keep built!');
                }
                if (buildingParts.gatehouse) {
                    buildingParts.gatehouse.material.opacity = 1;
                    console.log('Gatehouse built!');
                }
                if (buildingParts.windows) {
                    buildingParts.windows.forEach(window => {
                        if (window) window.material.opacity = 1;
                    });
                    console.log('Windows installed!');
                }
                if (buildingParts.entrance) {
                    buildingParts.entrance.material.opacity = 1;
                    console.log('Main gate built!');
                }
                if (buildingParts.flags) {
                    buildingParts.flags.forEach(flag => {
                        if (flag) flag.material.opacity = 1;
                    });
                    console.log('Castle flags raised!');
                }
                break;
        }
    };
    
    // Dramatic castle destruction system
    const destroyHouse = (scene) => {
        const houseParts = scene.userData.houseParts;
        if (!houseParts || scene.userData.isDestroying) return;
        
        scene.userData.isDestroying = true;
        console.log('💥 CASTLE DESTRUCTION INITIATED! 💥');
        
        // Create dramatic explosion particles
        createExplosionParticles(scene);
        
        // Add screen shake effect
        addScreenShake(scene);
        
        // Dramatic destruction sequence for castle with more visible effects
        const destructionSequence = [
            { part: houseParts.flags, delay: 0, fallDirection: [0, -15, 0], rotation: [0, 0, Math.PI] },
            { part: houseParts.keep, delay: 500, fallDirection: [0, -12, 0], rotation: [0, 0, Math.PI/4] },
            { part: houseParts.gatehouse, delay: 1000, fallDirection: [3, -10, -2], rotation: [0, 0, -Math.PI/6] },
            { part: houseParts.towers, delay: 1500, fallDirection: [0, -8, 0], rotation: [0, 0, Math.PI/3] },
            { part: houseParts.outerWalls, delay: 2000, fallDirection: [0, -6, 0], rotation: [0, 0, Math.PI/8] },
            { part: houseParts.foundation, delay: 2500, fallDirection: [0, -4, 0], rotation: [0, 0, Math.PI/12] }
        ];
        
        destructionSequence.forEach(({ part, delay, fallDirection, rotation }) => {
            if (Array.isArray(part)) {
                part.forEach((p, index) => {
                    if (p) {
                        setTimeout(() => {
                            animateDestructionWithRotation(p, fallDirection, rotation);
                        }, delay + (index * 200));
                    }
                });
            } else if (part) {
                setTimeout(() => {
                    animateDestructionWithRotation(part, fallDirection, rotation);
                }, delay);
            }
        });
        
        // Windows destruction with more dramatic effects
        setTimeout(() => {
            if (houseParts.windows) {
                houseParts.windows.forEach((window, index) => {
                    setTimeout(() => {
                        animateDestructionWithRotation(window, [
                            (Math.random() - 0.5) * 8,
                            -5,
                            (Math.random() - 0.5) * 8
                        ], [0, 0, Math.random() * Math.PI]);
                    }, index * 200);
                });
            }
            
            if (houseParts.entrance) {
                setTimeout(() => {
                    animateDestructionWithRotation(houseParts.entrance, [0, -6, 4], [0, 0, Math.PI/4]);
                }, 1000);
            }
        }, 2200);
        
        // Add debris particles during destruction
        setTimeout(() => {
            createDebrisParticles(scene);
        }, 1000);
        
        // Show destruction complete message
        setTimeout(() => {
            showDestructionComplete(scene);
        }, 4000);
        
        // Reset after 6 seconds and return to home page
        setTimeout(() => {
            resetHouse(scene);
            // Trigger return to home page
            if (window.location) {
                window.location.reload();
            }
        }, 6000);
    };
    
    // Create dramatic explosion particles
    const createExplosionParticles = (scene) => {
        const particleCount = 200;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.1);
            const particleMaterial = new THREE.MeshLambertMaterial({ 
                color: [0xFF4500, 0xFF6347, 0xFF8C00, 0xFFD700][Math.floor(Math.random() * 4)],
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Random explosion pattern
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 8;
            const height = Math.random() * 6;
            
            particle.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            // Store velocity for animation
            particle.userData.velocity = {
                x: (Math.random() - 0.5) * 0.3,
                y: Math.random() * 0.4 + 0.2,
                z: (Math.random() - 0.5) * 0.3
            };
            
            particle.userData.life = 1.0;
            particles.add(particle);
        }
        
        scene.add(particles);
        scene.userData.explosionParticles = particles;
        
        // Animate particles
        animateExplosionParticles(particles);
    };
    
    // Animate explosion particles
    const animateExplosionParticles = (particles) => {
        const animate = () => {
            particles.children.forEach(particle => {
                const velocity = particle.userData.velocity;
                const life = particle.userData.life;
                
                if (life > 0) {
                    // Update position
                    particle.position.x += velocity.x;
                    particle.position.y += velocity.y;
                    particle.position.z += velocity.z;
                    
                    // Gravity effect
                    velocity.y -= 0.02;
                    
                    // Fade out
                    particle.userData.life -= 0.02;
                    particle.material.opacity = life;
                    
                    // Scale down
                    particle.scale.setScalar(life);
                    
                    requestAnimationFrame(animate);
                }
            });
        };
        
        animate();
        
        // Remove particles after animation
        setTimeout(() => {
            if (scene.userData.explosionParticles) {
                scene.remove(scene.userData.explosionParticles);
                scene.userData.explosionParticles = null;
            }
        }, 3000);
    };
    
    // Animate individual part destruction
    const animateDestruction = (part, fallDirection) => {
        if (!part) return;
        
        const originalPosition = part.position.clone();
        const originalRotation = part.rotation.clone();
        const originalScale = part.scale.clone();
        
        let velocity = 0;
        const gravity = -0.015;
        let time = 0;
        
        const animate = () => {
            time += 0.016; // 60fps
            
            // Fall with physics
            velocity += gravity;
            part.position.y += velocity;
            
            // Horizontal movement
            part.position.x += fallDirection[0] * 0.01;
            part.position.z += fallDirection[2] * 0.01;
            
            // Dramatic rotation
            part.rotation.x += 0.1;
            part.rotation.y += 0.15;
            part.rotation.z += 0.08;
            
            // Scale down as it falls
            const scaleFactor = Math.max(0.1, 1 - time * 0.5);
            part.scale.setScalar(scaleFactor);
            
            // Continue animation until hitting ground
            if (part.position.y > -10 && scaleFactor > 0.1) {
                requestAnimationFrame(animate);
                } else {
                // Hide part after destruction
                part.material.opacity = 0;
            }
        };
        
        animate();
    };
    
    // Enhanced destruction animation with rotation
    const animateDestructionWithRotation = (mesh, fallDirection, rotationDirection) => {
        if (!mesh) return;
        
        const startPosition = mesh.position.clone();
        const startRotation = mesh.rotation.clone();
        const fallSpeed = 0.03;
        const rotationSpeed = 0.08;
        
        // Add dramatic scaling effect
        const originalScale = mesh.scale.clone();
        mesh.scale.multiplyScalar(1.1);
        
        const animate = () => {
            mesh.position.y -= fallSpeed;
            mesh.position.x += fallDirection[0] * fallSpeed * 0.15;
            mesh.position.z += fallDirection[2] * fallSpeed * 0.15;
            
            mesh.rotation.x += rotationSpeed + rotationDirection[0];
            mesh.rotation.y += rotationSpeed * 0.7 + rotationDirection[1];
            mesh.rotation.z += rotationSpeed * 0.4 + rotationDirection[2];
            
            // Add wobble effect
            mesh.position.x += Math.sin(Date.now() * 0.01) * 0.02;
            mesh.position.z += Math.cos(Date.now() * 0.01) * 0.02;
            
            // Gradually fade out
            if (mesh.material && mesh.material.opacity !== undefined) {
                mesh.material.opacity = Math.max(0, mesh.material.opacity - 0.01);
            }
            
            if (mesh.position.y > -15) {
                requestAnimationFrame(animate);
            } else {
                mesh.visible = false;
            }
        };
        
        animate();
    };
    
    // Add screen shake effect during destruction
    const addScreenShake = (scene) => {
        const camera = scene.userData.camera;
        if (!camera) return;
        
        const originalPosition = camera.position.clone();
        const shakeIntensity = 0.3;
        const shakeDuration = 3000;
        const startTime = Date.now();
        
        const shake = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < shakeDuration) {
                const intensity = shakeIntensity * (1 - elapsed / shakeDuration);
                camera.position.x = originalPosition.x + (Math.random() - 0.5) * intensity;
                camera.position.y = originalPosition.y + (Math.random() - 0.5) * intensity;
                camera.position.z = originalPosition.z + (Math.random() - 0.5) * intensity;
                requestAnimationFrame(shake);
            } else {
                camera.position.copy(originalPosition);
            }
        };
        
        shake();
    };
    
    // Create debris particles during destruction
    const createDebrisParticles = (scene) => {
        const debrisCount = 50;
        const debrisGroup = new THREE.Group();
        
        for (let i = 0; i < debrisCount; i++) {
            const debrisGeometry = new THREE.BoxGeometry(
                Math.random() * 0.2 + 0.1,
                Math.random() * 0.2 + 0.1,
                Math.random() * 0.2 + 0.1
            );
            const debrisMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(Math.random() * 0.1, 0.7, 0.3)
            });
            const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
            
            debris.position.set(
                (Math.random() - 0.5) * 10,
                Math.random() * 5 + 2,
                (Math.random() - 0.5) * 10
            );
            
            debris.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            debrisGroup.add(debris);
        }
        
        scene.add(debrisGroup);
        
        // Animate debris falling
        const animateDebris = () => {
            debrisGroup.children.forEach(debris => {
                debris.position.y -= 0.05;
                debris.rotation.x += 0.02;
                debris.rotation.y += 0.03;
                debris.rotation.z += 0.01;
                
                if (debris.material.opacity !== undefined) {
                    debris.material.opacity = Math.max(0, debris.material.opacity - 0.005);
                }
            });
            
            if (debrisGroup.children.some(debris => debris.position.y > -5)) {
                requestAnimationFrame(animateDebris);
            } else {
                scene.remove(debrisGroup);
            }
        };
        
        animateDebris();
    };
    
    // Show destruction complete message
    const showDestructionComplete = (scene) => {
        // Create a text element (using HTML overlay)
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: #ff4444;
                padding: 30px;
                border-radius: 15px;
                font-size: 24px;
                font-weight: bold;
                text-align: center;
                z-index: 1000;
                border: 3px solid #ff4444;
                box-shadow: 0 0 30px rgba(255, 68, 68, 0.5);
                animation: pulse 1s infinite;
            ">
                💥 CASTLE DESTROYED! 💥<br>
                <div style="font-size: 16px; margin-top: 10px; color: #fff;">
                    Returning to home page...
                </div>
            </div>
            <style>
                @keyframes pulse {
                    0% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.05); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
            </style>
        `;
        
        document.body.appendChild(messageDiv);
        
        // Remove message after 2 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 2000);
    };
    
    // Reset house after destruction
    const resetHouse = (scene) => {
        const houseParts = scene.userData.houseParts;
        if (!houseParts) return;
        
        console.log('🏗️ Rebuilding house...');
        
        // Reset all parts
        Object.values(houseParts).forEach(part => {
            if (Array.isArray(part)) {
                part.forEach(p => {
                    if (p && p.material) {
                        p.material.opacity = 0;
                        p.position.copy(p.userData.originalPosition || p.position);
                        p.rotation.copy(p.userData.originalRotation || p.rotation);
                        p.scale.copy(p.userData.originalScale || p.scale);
                    }
                });
            } else if (part && part.material) {
                part.material.opacity = 0;
                part.position.copy(part.userData.originalPosition || part.position);
                part.rotation.copy(part.userData.originalRotation || part.rotation);
                part.scale.copy(part.userData.originalScale || part.scale);
            }
        });
        
        // Reset building phase
        scene.userData.currentPhase = 0;
        scene.userData.phaseStartTime = Date.now();
        scene.userData.isDestroying = false;
        
        console.log('🏠 House reset and ready for rebuilding!');
    };
    
    // Enhanced animation loop with building phases
    useEffect(() => {
        if (!sceneRef.current) return;
        
        const { scene, camera, renderer } = sceneRef.current;
        
        console.log('Starting enhanced animation loop with building phases...');
        console.log('Initial gameState:', { isBuilding: gameState.isBuilding, buildStage: gameState.buildStage });
        
        // Debug building state changes
        let lastBuildingState = gameState.isBuilding;
        const checkBuildingState = () => {
            if (gameState.isBuilding !== lastBuildingState) {
                console.log('Building state changed:', lastBuildingState, '->', gameState.isBuilding);
                lastBuildingState = gameState.isBuilding;
            }
        };
        
        // Store original positions for reset
        if (scene.userData.houseParts) {
            Object.values(scene.userData.houseParts).forEach(part => {
                if (Array.isArray(part)) {
                    part.forEach(p => {
                        if (p) {
                            p.userData.originalPosition = p.position.clone();
                            p.userData.originalRotation = p.rotation.clone();
                            p.userData.originalScale = p.scale.clone();
                        }
                    });
                } else if (part) {
                    part.userData.originalPosition = part.position.clone();
                    part.userData.originalRotation = part.rotation.clone();
                    part.userData.originalScale = part.scale.clone();
                }
            });
        }
        
        // Touch/Click event listeners for destruction
        const handleDestruction = (event) => {
            // Only destroy if building is active
            if (!gameState.isBuilding) {
                return;
            }
            
            // Don't destroy if clicking on UI elements
            const target = event.target;
            const isUIElement = target.closest('.timer-panel') || 
                               target.closest('.ui-overlay') || 
                               target.closest('.nav-tabs') ||
                               target.closest('.panel-content') ||
                               target.closest('button') ||
                               target.closest('input') ||
                               target.closest('label') ||
                               target.closest('.mobile-menu-toggle');
            
            if (isUIElement) {
                console.log('UI element clicked, not destroying building');
                return;
            }
            
            event.preventDefault();
            console.log('💥 TOUCH/CLICK DETECTED - DESTROYING BUILDING! 💥');
            destroyHouse(scene);
        };
        
        // Add event listeners
        document.addEventListener('touchstart', handleDestruction);
        document.addEventListener('click', handleDestruction);
        
        // Smooth camera movement
        let time = 0;
        let lastBuildStage = 0;
        const animate = () => {
            time += 0.005;
            
            // Check for building state changes
            checkBuildingState();
            
            // More sophisticated camera movement for castle
            const radius = 20;
            const height = 12;
            camera.position.x = Math.cos(time) * radius;
            camera.position.y = height + Math.sin(time * 0.5) * 2;
            camera.position.z = Math.sin(time) * radius;
            
            // Camera always looks at the castle center
            camera.lookAt(0, 4, 0);
            
            // Animate worker movement around the construction site
            if (scene.userData.workerGroup && scene.userData.workerMovement) {
                const worker = scene.userData.workerGroup;
                const movement = scene.userData.workerMovement;
                
                // Update movement time
                movement.time += 0.01;
                
                // Get current target position
                const currentTarget = movement.path[movement.currentTarget];
                const nextTarget = movement.path[(movement.currentTarget + 1) % movement.path.length];
                
                // Calculate progress between current and next target
                const progress = (movement.time * movement.speed) % 1;
                
                // Interpolate position
                const currentX = currentTarget.x + (nextTarget.x - currentTarget.x) * progress;
                const currentZ = currentTarget.z + (nextTarget.z - currentTarget.z) * progress;
                
                // Update worker position
                worker.position.x = currentX;
                worker.position.z = currentZ;
                
                // Rotate worker to face movement direction
                const angle = Math.atan2(nextTarget.z - currentTarget.z, nextTarget.x - currentTarget.x);
                worker.rotation.y = angle;
                
                // Add walking animation
                worker.position.y = 0.1 + Math.sin(movement.time * 10) * 0.05;
                
                // Move to next target when reaching current one
                if (progress > 0.95) {
                    movement.currentTarget = (movement.currentTarget + 1) % movement.path.length;
                }
            }
            
            // Build progressively based on buildStage
            if (scene.userData.houseParts) {
                if (gameState.isBuilding) {
                    // Update to current build stage
                    if (gameState.buildStage > lastBuildStage) {
                        for (let phase = lastBuildStage + 1; phase <= Math.min(gameState.buildStage, 4); phase++) {
                            buildPhase(phase, scene.userData.houseParts);
                        }
                        lastBuildStage = gameState.buildStage;
                    } else if (gameState.buildStage < lastBuildStage) {
                        // Reset if we somehow went backwards
                        hideCastle(scene.userData.houseParts);
                        lastBuildStage = 0;
                    }
                } else if (!scene.userData.isDestroying) {
                    if (gameState.buildStage >= 4) {
                        // Completed successfully
                        showCompletedCastle(scene.userData.houseParts);
                    } else if (gameState.buildStage === 0 && lastBuildStage > 0) {
                        // Reset to empty
                        hideCastle(scene.userData.houseParts);
                        lastBuildStage = 0;
                    }
                }
            }
            
            // Ensure we're rendering
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
        
        return () => {
            // Cleanup event listeners
            document.removeEventListener('touchstart', handleDestruction);
            document.removeEventListener('click', handleDestruction);
        };
    }, [gameState.isBuilding, gameState.buildStage]);

    // Reactively update village visibility when housesBuilt changes
    useEffect(() => {
        if (!sceneRef.current) return;
        const { scene } = sceneRef.current;
        updateVillageVisibility(scene, housesBuilt);
        console.log('Village updated: showing', housesBuilt, 'houses');
    }, [housesBuilt]);

    return React.createElement(window.ThreeCanvas, {
        camera: { position: [20, 15, 20], fov: 45 },
        onMount: setupScene
    });
};

window.GameScene = GameScene;
